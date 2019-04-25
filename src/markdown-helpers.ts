import { expect } from 'chai';
import Token from 'markdown-it/lib/token';
import {
  TypeInformation,
  PropertyDocumentationBlock,
  MethodParameterDocumentation,
  PossibleStringValue,
} from './ParsedDocumentation';

export const findNextList = (tokens: Token[]) => {
  const start = tokens.findIndex(t => t.type === 'bullet_list_open');
  if (start === -1) return null;
  let opened = 1;
  let end = -1;
  for (const [index, token] of tokens.slice(start + 1).entries()) {
    if (token.type === 'bullet_list_open') opened += 1;
    if (token.type === 'bullet_list_close') opened -= 1;
    if (opened === 0) {
      end = index;
      break;
    }
  }
  if (end === -1) return null;

  return tokens.slice(start, start + end + 1);
};

export const findFirstHeading = (tokens: Token[]) => {
  const open = tokens.findIndex(token => token.type === 'heading_open');
  expect(open).to.not.equal(-1, "expected to find a heading token but couldn't");
  expect(tokens[open + 2].type).to.equal('heading_close');
  return tokens[open + 1];
};

export const findContentAfterList = (tokens: Token[], returnAllOnNoList = false) => {
  let start = -1;
  let opened = 0;
  let foundBulletListOpen = false;
  for (const [index, token] of tokens.entries()) {
    if (token.type === 'bullet_list_open') {
      opened += 1;
      foundBulletListOpen = true;
    }
    if (token.type === 'bullet_list_close') {
      opened -= 1;
    }
    if (opened === 0 && foundBulletListOpen) {
      start = index;
      break;
    }
  }
  if (start === -1) {
    if (!returnAllOnNoList) return [];
    start = tokens.findIndex(t => t.type === 'heading_close');
  }
  const end = tokens.slice(start).findIndex(t => t.type === 'heading_open');
  if (end === -1) return tokens.slice(start + 1);
  return tokens.slice(start + 1, end);
};

export const findContentAfterHeadingClose = (tokens: Token[]) => {
  const start = tokens.findIndex(t => t.type === 'heading_close');
  const end = tokens.slice(start).findIndex(t => t.type === 'heading_open');
  if (end === -1) return tokens.slice(start + 1);
  return tokens.slice(start + 1, end);
};

export type HeadingContent = {
  heading: string;
  level: number;
  headingTokens: Token[];
  content: Token[];
};

export const headingsAndContent = (tokens: Token[]): HeadingContent[] => {
  const groups: HeadingContent[] = [];
  for (const [start, token] of tokens.entries()) {
    if (token.type !== 'heading_open') continue;

    const headingTokens = tokens.slice(
      start + 1,
      start +
        tokens.slice(start).findIndex(t => t.type === 'heading_close' && t.level === token.level),
    );

    const startLevel = parseInt(token.tag.replace('h', ''), 10);

    const content = tokens.slice(start + headingTokens.length);
    const contentEnd = content.findIndex(
      t => t.type === 'heading_open' && parseInt(t.tag.replace('h', ''), 10) <= startLevel,
    );

    groups.push({
      heading: safelyJoinTokens(headingTokens).trim(),
      level: startLevel,
      headingTokens,
      content: contentEnd === -1 ? content : content.slice(0, contentEnd),
    });
  }

  return groups;
};

export const findConstructorHeader = (tokens: Token[]) => {
  const groups = headingsAndContent(tokens);
  const constructorHeader = groups.find(
    group => group.heading.startsWith('`new ') && group.level === 3,
  );
  return constructorHeader ? constructorHeader : null;
};

export const findContentInsideHeader = (
  tokens: Token[],
  expectedHeader: string,
  expectedLevel: number,
) => {
  const group = headingsAndContent(tokens).find(
    g => g.heading === expectedHeader && g.level === expectedLevel,
  );
  if (!group) return null;
  return group.content;
};

export const rawTypeToTypeInformation = (
  rawType: string,
  relatedDescription: string,
  subTypedKeys: TypedKey[] | null,
): TypeInformation => {
  // Handle the edge case of "null"
  if (rawType === 'null' || rawType === '`null`') {
    return {
      type: 'null',
      collection: false,
    };
  }

  let collection = false;
  let typeString = rawType;
  if (rawType.endsWith('[]')) {
    collection = true;
    typeString = rawType.substr(0, rawType.length - 2);
  }
  typeString = typeString.trim().replace(/^\((.+)\)$/, '$1');

  const multiTypes = typeString.split(/(?:\|)|(?:\bor\b)/);
  if (multiTypes.length > 1) {
    return {
      collection,
      type: multiTypes
        .map(multiType => multiType.trim())
        .map(multiType => rawTypeToTypeInformation(multiType, relatedDescription, subTypedKeys)),
    };
  }

  if (typeString === 'Function') {
    return {
      collection,
      type: 'Function',
      parameters: subTypedKeys
        ? subTypedKeys.map<MethodParameterDocumentation>(typedKey => ({
            name: typedKey.key,
            description: typedKey.description,
            required: typedKey.required,
            ...typedKey.type,
          }))
        : [],
      returns: null,
    };
  } else if (typeString === 'Object') {
    return {
      collection,
      type: 'Object',
      properties: subTypedKeys
        ? subTypedKeys.map<PropertyDocumentationBlock>(typedKey => ({
            name: typedKey.key,
            description: typedKey.description,
            required: typedKey.required,
            ...typedKey.type,
          }))
        : [],
    };
  } else if (typeString === 'String') {
    return {
      collection,
      type: 'String',
      possibleValues: subTypedKeys
        ? subTypedKeys.map<PossibleStringValue>(typedKey => ({
            value: typedKey.key,
            description: typedKey.description,
          }))
        : relatedDescription
        ? extractStringEnum(relatedDescription)
        : null,
    };
  }

  const genericTypeMatch = typeString.match(/^(.+)<(.+)>$/);
  if (genericTypeMatch) {
    const genericTypeString = genericTypeMatch[1];
    const innerTypes = genericTypeMatch[2]
      .split(',')
      .map(t => rawTypeToTypeInformation(t.trim(), '', null))
      .map(info => {
        if (info.type === 'Object') {
          return {
            ...info,
            type: 'Object',
            properties: subTypedKeys
              ? subTypedKeys.map<PropertyDocumentationBlock>(typedKey => ({
                  name: typedKey.key,
                  description: typedKey.description,
                  required: typedKey.required,
                  ...typedKey.type,
                }))
              : [],
          };
        }
        return info;
      });

    // Special case, when the generic type is "Function" then the first N - 1 innerTypes are
    // parameter types and the Nth innerType is the return type
    if (genericTypeString === 'Function') {
      return {
        collection,
        type: 'Function',
        parameters: innerTypes.slice(0, innerTypes.length - 2),
        returns: innerTypes[innerTypes.length - 1],
      };
    }
    return {
      collection,
      type: genericTypeString,
      innerTypes: innerTypes,
    };
  }

  return {
    collection,
    type: typeString,
  };
};

export enum StripReturnTypeBehavior {
  STRIP,
  DO_NOT_STRIP,
}

export const extractStringEnum = (description: string): PossibleStringValue[] | null => {
  const possibleValues: PossibleStringValue[] = [];

  const inlineValuesPattern = /(?:can be|values include) ((?:(?:`[a-zA-Z-]+`)(?:, ))*(?:`[a-zA-Z-]+`)?(?: (?:or|and) `[a-zA-Z-]+`)?)/i;
  const inlineMatch = inlineValuesPattern.exec(description);
  if (inlineMatch) {
    const valueString = inlineMatch[1];
    const valuePattern = /`([a-zA-Z-]+)`/g;
    let value = valuePattern.exec(valueString);

    while (value) {
      possibleValues.push({
        value: value[1],
        description: '',
      });
      value = valuePattern.exec(valueString);
    }

    return possibleValues.length === 0 ? null : possibleValues;
  }

  return null;
};

export const extractReturnType = (
  tokens: Token[],
  stripTypeFromDescription = StripReturnTypeBehavior.STRIP,
  prefix = 'Returns',
): {
  parsedDescription: string;
  parsedReturnType: TypeInformation | null;
} => {
  const rawDescription = safelyJoinTokens(tokens);
  const description = rawDescription.trim();
  if (!new RegExp(`^${prefix} `, 'igm').test(description.trim())) {
    return {
      parsedDescription: description,
      parsedReturnType: null,
    };
  }

  const returnsWithNewLineMatch = description.match(
    new RegExp(`${prefix} \`([^\`]+?)\`:?(\. |\n|$)`),
  );
  const returnsWithHyphenMatch = description.match(new RegExp(`${prefix} \`([^\`]+?)\` - `));
  const returnsWithContinousSentence = description.match(new RegExp(`${prefix} \`([^\`]+?)\` `));

  let parsedDescription = description;
  let rawReturnType: string;

  if (returnsWithNewLineMatch) {
    rawReturnType = returnsWithNewLineMatch[1];
    if (stripTypeFromDescription === StripReturnTypeBehavior.STRIP)
      parsedDescription = description.replace(returnsWithNewLineMatch[0], '');
  } else if (returnsWithHyphenMatch) {
    rawReturnType = returnsWithHyphenMatch[1];
    if (stripTypeFromDescription === StripReturnTypeBehavior.STRIP)
      parsedDescription = description.replace(returnsWithHyphenMatch[0], '');
  } else if (returnsWithContinousSentence) {
    rawReturnType = returnsWithContinousSentence[1];
    if (stripTypeFromDescription === StripReturnTypeBehavior.STRIP)
      parsedDescription = description.replace(returnsWithContinousSentence[0], '');
  } else {
    return {
      parsedDescription: description,
      parsedReturnType: null,
    };
  }

  const list = findNextList(tokens);
  let typedKeys: null | TypedKey[] = null;
  if (list) {
    try {
      typedKeys = convertListToTypedKeys(tokens);
    } catch {}
  }

  return {
    parsedDescription: parsedDescription.trim(),
    parsedReturnType: rawTypeToTypeInformation(rawReturnType, parsedDescription, typedKeys),
  };
};

// NOTE: This method obliterates code fences
export const safelyJoinTokens = (tokens: Token[]) => {
  let joinedContent = '';
  let listLevel = -1;
  for (const tokenToCheck of tokens) {
    if (tokenToCheck.children !== null && tokenToCheck.type === 'inline') {
      joinedContent += safelyJoinTokens(tokenToCheck.children);
      continue;
    }
    expect(tokenToCheck.children).to.equal(
      null,
      'There should be no nested children in the joinable tokens',
    );

    expect(tokenToCheck.type).to.be.oneOf(
      [
        'text',
        'link_open',
        'link_close',
        'softbreak',
        'code_inline',
        'strong_open',
        'strong_close',
        'paragraph_open',
        'paragraph_close',
        'bullet_list_open',
        'bullet_list_close',
        'list_item_open',
        'list_item_close',
        'em_open',
        'em_close',
        'fence',
        's_open',
        's_close',
        'blockquote_open',
        'blockquote_close',
      ],
      'We only support plain text, links, softbreaks, inline code, strong tags and paragraphs inside joinable tokens',
    );
    // Be explicit here about which token types we support and the actions that are taken
    switch (tokenToCheck.type) {
      case 'softbreak':
        joinedContent += ' ';
        break;
      case 'code_inline':
        joinedContent += `${tokenToCheck.markup}${tokenToCheck.content}${tokenToCheck.markup}`;
        break;
      case 'blockquote_open':
        joinedContent += `${tokenToCheck.markup} `;
        break;
      case 'strong_open':
      case 'strong_close':
      case 'em_open':
      case 'em_close':
      case 's_open':
      case 's_close':
        joinedContent += tokenToCheck.markup;
        break;
      case 'text':
      case 'link_open':
      case 'link_close':
        joinedContent += tokenToCheck.content;
        break;
      case 'paragraph_close':
        joinedContent += '\n\n';
        break;
      case 'list_item_open':
        // Provide correct indentation
        for (let i = 0; i < listLevel; i += 1) {
          joinedContent += '  ';
        }
        joinedContent += '* ';
        break;
      case 'list_item_close': {
        // On close of a list item we also closed a paragraph so let's remove one of the trailing new lines
        if (joinedContent.endsWith('\n')) {
          joinedContent = joinedContent.slice(0, joinedContent.length - 1);
        }
        break;
      }
      case 'bullet_list_open':
        // If we are opening a new list inside a list we need to strip a new line from the last close paragraph
        if (listLevel > -1) {
          joinedContent = joinedContent.slice(0, joinedContent.length - 1);
        }
        listLevel += 1;
        break;
      case 'bullet_list_close':
        // On close of a nested list, add an extra new line
        if (listLevel > -1) {
          joinedContent += '\n';
        }
        listLevel -= 1;
        break;
      case 'paragraph_open':
      case 'blockquote_close':
      case 'fence':
        break;
      default:
        expect(false).to.equal(true, 'unreachable default switch case');
    }
  }

  return joinedContent.trim();
};

type TypedKey = {
  key: string;
  type: TypeInformation;
  description: string;
  required: boolean;
};

type List = { items: ListItem[] };
type ListItem = { tokens: Token[]; nestedList: List | null };

const getNestedList = (rawTokens: Token[]): List => {
  const rootList: List = { items: [] };

  const depthMap: Map<number, List | null> = new Map();
  depthMap.set(0, rootList);
  let current: ListItem | null = null;
  let currentDepth = 0;
  for (const token of rawTokens) {
    const currentList = depthMap.get(currentDepth)!;
    if (token.type === 'list_item_close') {
      if (current && !currentList.items.includes(current)) currentList.items.push(current);
      current = null;
    } else if (token.type === 'list_item_open') {
      current = { tokens: [], nestedList: null };
    } else if (token.type === 'bullet_list_open' && current) {
      expect(currentList).to.not.equal(
        null,
        'we should not ever have a sub list without a parent list',
      );
      current!.nestedList = { items: [] };
      currentDepth += 1;
      depthMap.set(currentDepth, current!.nestedList!);
      currentList.items.push(current);
    } else if (token.type === 'bullet_list_close') {
      depthMap.set(currentDepth, null);
      currentDepth -= 1;
    } else {
      if (current) current.tokens.push(token);
    }
  }

  return rootList;
};

const convertNestedListToTypedKeys = (list: List): TypedKey[] => {
  const keys: TypedKey[] = [];

  for (const item of list.items) {
    // If the current list would fail checks, but it has a nested list, assume that the nested list is the content we want
    // E.g.
    // * `foo` - String
    //   * On windows these keys
    //      * `option1`
    //      * `option2`
    if (
      (item.tokens.length !== 3 ||
        !item.tokens[1].children ||
        item.tokens[1].children.length < 1 ||
        item.tokens[1].children[0].type !== 'code_inline') &&
      item.nestedList
    ) {
      keys.push(...convertNestedListToTypedKeys(item.nestedList));
      continue;
    }
    // Anything other than 3 items and the logic below is making a bad assumption, let's fail violently
    expect(item.tokens).to.have.lengthOf(
      3,
      'Expected list item representing a typed key to have 3 child tokens',
    );

    // We take the middle token as it is the thing enclosed in the paragraph
    const targetToken = item.tokens[1];
    // Need at least a key and a type
    expect(targetToken.children.length).to.be.at.least(
      1,
      'Expected token token to have at least 1 child for typed key extraction',
    );
    const keyToken = targetToken.children[0];
    expect(keyToken.type).to.equal('code_inline', 'Expected key token to be an inline code block');
    const typeAndDescriptionTokens = targetToken.children.slice(1);
    const joinedContent = safelyJoinTokens(typeAndDescriptionTokens);

    let rawType = 'String';
    if (typeAndDescriptionTokens.length !== 0) {
      rawType = joinedContent.split('-')[0];
    }

    const rawDescription = joinedContent.substr(rawType.length);

    expect(rawDescription).not.to.match(
      / ?\(optional\) ?/i,
      'optionality for a typed key should be defined before the "-" and after the type',
    );

    const isRootOptional = / ?\(optional\) ?/i.test(rawType);
    const cleanedType = rawType.replace(/ ?\(optional\) ?/i, '').replace(/_.+?_/g, '');
    const subTypedKeys = item.nestedList ? convertNestedListToTypedKeys(item.nestedList) : null;
    const type = rawTypeToTypeInformation(cleanedType.trim(), rawDescription, subTypedKeys);

    keys.push({
      type,
      key: keyToken.content,
      description: rawDescription.trim().replace(/^- ?/, ''),
      required: !isRootOptional,
    });
  }

  return keys;
};

export const convertListToTypedKeys = (listTokens: Token[]): TypedKey[] => {
  const list = getNestedList(listTokens);

  return convertNestedListToTypedKeys(list);
};
