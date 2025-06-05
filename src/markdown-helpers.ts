import { expect } from 'chai';
import { Token } from 'markdown-it';
import {
  TypeInformation,
  PropertyDocumentationBlock,
  MethodParameterDocumentation,
  PossibleStringValue,
  DocumentationTag,
  ProcessBlock,
} from './ParsedDocumentation.js';

const tagMap = {
  macOS: DocumentationTag.OS_MACOS,
  mas: DocumentationTag.OS_MAS,
  Windows: DocumentationTag.OS_WINDOWS,
  Linux: DocumentationTag.OS_LINUX,
  Experimental: DocumentationTag.STABILITY_EXPERIMENTAL,
  Deprecated: DocumentationTag.STABILITY_DEPRECATED,
  Readonly: DocumentationTag.AVAILABILITY_READONLY,
};

const ALLOWED_TAGS = Object.keys(tagMap) as (keyof typeof tagMap)[];

export const parseHeadingTags = (tags: string | null): DocumentationTag[] => {
  if (!tags) return [];

  const parsedTags: (keyof typeof tagMap)[] = [];
  const matcher = / _([^_]+)_/g;
  let match: RegExpMatchArray | null;
  while ((match = matcher.exec(tags))) {
    expect(ALLOWED_TAGS).to.contain(
      match[1],
      `heading tags must be from the allowlist: ${JSON.stringify(ALLOWED_TAGS)}`,
    );
    parsedTags.push(match[1] as keyof typeof tagMap);
  }

  return parsedTags.map((value) => {
    if (tagMap[value]) return tagMap[value];

    throw new Error(
      `Impossible scenario detected, "${value}" is not an allowed tag but it got past the allowed tags check`,
    );
  });
};

export const findNextList = (tokens: Token[]) => {
  const start = tokens.findIndex((t) => t.type === 'bullet_list_open');
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
  const open = tokens.findIndex((token) => token.type === 'heading_open');
  expect(open).to.not.equal(-1, "expected to find a heading token but couldn't");
  expect(tokens).to.have.lengthOf.at.least(open + 2);
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
    start = tokens.findIndex((t) => t.type === 'heading_close');
  }
  const end = tokens.slice(start).findIndex((t) => t.type === 'heading_open');
  if (end === -1) return tokens.slice(start + 1);
  return tokens.slice(start + 1, end);
};

export const findContentAfterHeadingClose = (tokens: Token[]) => {
  const start = tokens.findIndex((t) => t.type === 'heading_close');
  const end = tokens.slice(start).findIndex((t) => t.type === 'heading_open');
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
        tokens.slice(start).findIndex((t) => t.type === 'heading_close' && t.level === token.level),
    );

    const startLevel = parseInt(token.tag.replace('h', ''), 10);

    const content = tokens.slice(start + headingTokens.length);
    const contentEnd = content.findIndex(
      (t) => t.type === 'heading_open' && parseInt(t.tag.replace('h', ''), 10) <= startLevel,
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

const getConstructorHeaderInGroups = (groups: HeadingContent[]) => {
  return groups.find((group) => group.heading.startsWith('`new ') && group.level === 3);
};

export const findConstructorHeader = (tokens: Token[]) => {
  const groups = headingsAndContent(tokens);
  const constructorHeader = getConstructorHeaderInGroups(groups);
  return constructorHeader ? constructorHeader : null;
};

export const getContentBeforeConstructor = (tokens: Token[]) => {
  const groups = headingsAndContent(tokens);
  const constructorHeader = getConstructorHeaderInGroups(groups);
  if (!constructorHeader) return [];

  return groups.slice(0, groups.indexOf(constructorHeader));
};

export const getContentBeforeFirstHeadingMatching = (
  tokens: Token[],
  matcher: (heading: string) => boolean,
) => {
  const groups = headingsAndContent(tokens);

  return groups.slice(
    0,
    groups.findIndex((g) => matcher(g.heading)),
  );
};

export const findContentInsideHeader = (
  tokens: Token[],
  expectedHeader: string,
  expectedLevel: number,
) => {
  const group = headingsAndContent(tokens).find(
    (g) => g.heading === expectedHeader && g.level === expectedLevel,
  );
  if (!group) return null;
  return group.content;
};

export const safelySeparateTypeStringOn = (typeString: string, targetChar: string) => {
  const types: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < typeString.length; i++) {
    const char = typeString[i];
    if (char === targetChar && depth === 0) {
      types.push(current);
      current = '';
    } else {
      current += char;
      switch (char) {
        case '<':
        case '{':
          depth++;
          break;
        case '>':
        case '}':
          depth--;
          break;
      }
    }
  }
  types.push(current);
  return types.map((t) => t.trim()).filter((t) => !!t);
};

export const getTopLevelMultiTypes = (typeString: string) => {
  return safelySeparateTypeStringOn(typeString, '|');
};

export const getTopLevelOrderedTypes = (typeString: string) => {
  return safelySeparateTypeStringOn(typeString, ',');
};

/**
 * @param typeString A type as a raw string
 *
 * @returns Either null or the isolated outer/generic types
 *
 * This method is used to extract the highest level generic from a type string.
 * Examples:
 *
 * - `Foo` --> `null`
 * - `Foo<T>` --> `{Foo, T}`
 * - `Foo<T<B, C>>` --> `{Foo, T<B, C>}`
 *
 * The caller is responsible for recursively parsing the generic
 */
export const getTopLevelGenericType = (typeString: string) => {
  if (
    typeString[typeString.length - 1] !== '>' &&
    typeString.slice(typeString.length - 3) !== '>[]'
  )
    return null;
  const start = typeString.indexOf('<');
  const end = typeString.length - [...typeString].reverse().indexOf('>') - 1;
  if (start === -1) return null;
  return {
    outerType: typeString.slice(0, start),
    genericType: typeString.slice(start + 1, end),
  };
};

export const rawTypeToTypeInformation = (
  rawType: string,
  relatedDescription: string,
  subTypedKeys: TypedKeyList | null,
): TypeInformation => {
  // Handle the edge case of "null"
  if (rawType === 'null' || rawType === '`null`') {
    return {
      type: 'null',
      collection: false,
    };
  }

  let collection = false;
  let typeString = rawType.trim();
  if (rawType.endsWith('[]')) {
    collection = true;
    typeString = rawType.substr(0, rawType.length - 2).trim();
  }
  // This impacts the above usage of "collection" if the last two chars were []
  // i.e. There is a strong different between "A | B[]" and "(A | B)[]" and "(A | B[])"
  // if collection === true and the subsequent value was wrapped it assumed the generated
  // type union is a "collection".  If it wasn't wrapped only the last item in the type union
  // is considered a "collection"
  const wasBracketWrapped = typeString.startsWith('(') && typeString.endsWith(')');
  typeString = typeString.replace(/^\((.+)\)$/, '$1');

  // const multiTypes = typeString.split(/(?:\|)|(?:\bor\b)/);
  const multiTypes = getTopLevelMultiTypes(typeString);
  if (multiTypes.length > 1) {
    return {
      collection: collection && wasBracketWrapped,
      type: multiTypes
        .map(
          // See the comment a few lines up on "wasBracketWrapped"
          // This re-inserts the stripped "[]" if appropriate
          (multiType, index) =>
            `${multiType.trim()}${
              index === multiTypes.length - 1 && !wasBracketWrapped && collection ? '[]' : ''
            }`,
        )
        .map((multiType) => rawTypeToTypeInformation(multiType, relatedDescription, subTypedKeys)),
    };
  }

  if (typeString === 'Function') {
    return {
      collection,
      type: 'Function',
      parameters:
        subTypedKeys && !subTypedKeys.consumed
          ? consumeTypedKeysList(subTypedKeys).map<MethodParameterDocumentation>((typedKey) => ({
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
      properties:
        subTypedKeys && !subTypedKeys.consumed
          ? consumeTypedKeysList(subTypedKeys).map<PropertyDocumentationBlock>((typedKey) => ({
              name: typedKey.key,
              description: typedKey.description,
              required: typedKey.required,
              additionalTags: typedKey.additionalTags,
              ...typedKey.type,
            }))
          : [],
    };
  } else if (typeString === 'Boolean' || typeString === 'Number' || typeString === 'String') {
    throw new Error(
      `Use lowercase "${typeString.toLowerCase()}" instead of "${typeString}" for a primitive type`,
    );
  } else if (typeString === 'string') {
    return {
      collection,
      type: 'string',
      possibleValues:
        subTypedKeys && !subTypedKeys.consumed
          ? consumeTypedKeysList(subTypedKeys).map<PossibleStringValue>((typedKey) => ({
              value: typedKey.key,
              description: typedKey.description,
            }))
          : relatedDescription
            ? extractStringEnum(relatedDescription)
            : null,
    };
  }

  const genericTypeMatch = getTopLevelGenericType(typeString);
  if (genericTypeMatch) {
    const genericTypeString = genericTypeMatch.outerType;
    const innerTypes = getTopLevelOrderedTypes(genericTypeMatch.genericType)
      .map((t) => rawTypeToTypeInformation(t.trim(), '', null))
      .map((info) => {
        if (info.type === 'Object') {
          return {
            ...info,
            type: 'Object',
            properties:
              subTypedKeys && !subTypedKeys.consumed
                ? consumeTypedKeysList(subTypedKeys).map<PropertyDocumentationBlock>(
                    (typedKey) => ({
                      name: typedKey.key,
                      description: typedKey.description,
                      required: typedKey.required,
                      additionalTags: typedKey.additionalTags,
                      ...typedKey.type,
                    }),
                  )
                : [],
          };
        }
        return info;
      });

    // Special case, when the generic type is "Event" then there should be no declared
    // innerTypes.  Instead we extract the following list as event parameters.
    if (genericTypeString === 'Event') {
      if (innerTypes.length) {
        if (subTypedKeys && !subTypedKeys.consumed) {
          throw new Error(
            'Found an Event<> declaration with a type declared in the generic, Event<> should not have declared inner types AND a parameter list',
          );
        }

        if (innerTypes.length > 1) {
          throw new Error(
            'Found an Event<> declaration with multiple types declared in the generic, Event<> should have at most one inner type',
          );
        }

        return {
          collection,
          type: 'Event',
          eventPropertiesReference: innerTypes[0],
        };
      } else {
        if (!subTypedKeys || subTypedKeys.consumed) {
          throw new Error(
            'Found an Event<> declaration without a parameter list, either declare as "Event" or provide a parameter list below',
          );
        }

        return {
          collection,
          type: 'Event',
          eventProperties: consumeTypedKeysList(subTypedKeys).map<PropertyDocumentationBlock>(
            (typedKey) => ({
              name: typedKey.key,
              description: typedKey.description,
              required: typedKey.required,
              additionalTags: typedKey.additionalTags,
              ...typedKey.type,
            }),
          ),
        };
      }
    }

    // Special case, when the generic type is "Function" then the first N - 1 innerTypes are
    // parameter types and the Nth innerType is the return type
    if (genericTypeString === 'Function') {
      const genericProvidedParams = innerTypes.slice(0, innerTypes.length - 1);

      return {
        collection,
        type: 'Function',
        parameters:
          // If no param types are provided in the <A, B, C> syntax then we should fallback to the normal one
          genericProvidedParams.length === 0
            ? subTypedKeys && !subTypedKeys.consumed
              ? consumeTypedKeysList(subTypedKeys).map<MethodParameterDocumentation>(
                  (typedKey) => ({
                    name: typedKey.key,
                    description: typedKey.description,
                    required: typedKey.required,
                    ...typedKey.type,
                  }),
                )
              : []
            : (genericProvidedParams as MethodParameterDocumentation[]),
        returns: innerTypes[innerTypes.length - 1],
      };
    }

    if (!innerTypes.length) {
      throw new Error(
        `Found a generic declaration without a type declared in the generic, T<> (${genericTypeString}<>) should have at least one inner type`,
      );
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

// All possible value separators, sorted by reverse length to ensure
// that we match the longer comma prefix variants first if they are present
const niceSeparators = [',', 'and', 'or', ', and', ', or'].sort((a, b) => b.length - a.length);
// Some string enums can also be objects, the final phrase is "or an object" and we
// should gracefully terminate in that case
const niceTerminators = [', or an Object', 'or an Object'].sort((a, b) => b.length - a.length);
const suffixesToIgnore = ['(Deprecated)'];

export const extractStringEnum = (description: string): PossibleStringValue[] | null => {
  const inlineValuesLocatorPattern = /(?:can be|values? includes?) (.+)/i;
  const locatorMatch = inlineValuesLocatorPattern.exec(description);
  if (!locatorMatch) return null;

  const valuesTokens = locatorMatch[1].split('');

  const state = {
    // Where are we in the valueTokens array
    position: 0,
    // What values have we found so far
    values: [] as string[],
    // The current value we are building, was found wrapped by `currentQuoter`
    currentValue: '',
    // The quote character that we encountered to start building a value
    // We won't stop adding characters to `currentValue` until the same character
    // is encountered again
    currentQuoter: null as null | string,
    // In some cases quoted values are wrapped with other markdown indicators, for
    // instance strikethrough ~ characters. This handles those to ensure anything
    // we allow as a wrapping character is unwrapped after a value is extracted.
    currentQuoterWrappers: [] as string[],
    // This is set to true after a value is extracted to allow us to parse out a
    // nice separator. For instance a "comma", a complete list is in `niceSeparators`
    // above.
    expectingNiceSeparator: false,
    // This is set after the state machine reaches a point that _could_ be the end,
    // an invalid token when this is set to true is not a fatal error rather the
    // graceful termination of the state machine.
    couldBeDone: false,
  };
  const lookAhead = (length: number) => {
    return valuesTokens.slice(state.position - 1, state.position + length - 1).join('');
  };
  stringEnumTokenLoop: while (state.position < valuesTokens.length) {
    const char = valuesTokens[state.position];
    state.position++;

    if (state.currentQuoter) {
      // We should never expect a separator inside a quoted value
      if (state.expectingNiceSeparator) {
        throw new Error('Impossible state encountered while extracting a string enum');
      }
      if (char === state.currentQuoter) {
        state.currentQuoter = null;
        state.values.push(state.currentValue);
        state.currentValue = '';
        state.expectingNiceSeparator = true;
      } else {
        state.currentValue += char;
      }
    } else {
      // Whitespace can be skipped
      if (char === ' ') {
        continue stringEnumTokenLoop;
      }

      // If we're between values we should be expecting one of the above "nice"
      // separators.
      if (state.expectingNiceSeparator) {
        // Before checking for a separator we need to ensure we have unwrapped any wrapping
        // chars
        if (state.currentQuoterWrappers.length) {
          const expectedUnwrap = state.currentQuoterWrappers.pop();
          if (char !== expectedUnwrap) {
            throw new Error(
              `Unexpected token while extracting string enum. Expected an unwrapping token that matched "${expectedUnwrap}". But found token: ${char}\nContext: "${
                locatorMatch[1]
              }"\n${' '.repeat(8 + state.position)}^`,
            );
          }
          continue stringEnumTokenLoop;
        }

        if (char === '.' || char === ';' || char === '-') {
          break stringEnumTokenLoop;
        }

        for (const suffix of suffixesToIgnore) {
          if (lookAhead(suffix.length) === suffix) {
            state.position += suffix.length - 1;
            continue stringEnumTokenLoop;
          }
        }

        for (const niceTerminator of niceTerminators) {
          if (lookAhead(niceTerminator.length) === niceTerminator) {
            state.position += niceTerminator.length - 1;
            state.expectingNiceSeparator = false;
            state.couldBeDone = true;
            continue stringEnumTokenLoop;
          }
        }

        for (const niceSeparator of niceSeparators) {
          if (lookAhead(niceSeparator.length) === niceSeparator) {
            state.position += niceSeparator.length - 1;
            state.expectingNiceSeparator = false;
            if (niceSeparator === ',') {
              state.couldBeDone = true;
            }
            continue stringEnumTokenLoop;
          }
        }
        throw new Error(
          `Unexpected separator token while extracting string enum, expected a comma or "and" or "or" but found "${char}"\nContext: ${
            locatorMatch[1]
          }\n${' '.repeat(8 + state.position)}^`,
        );
      }

      if (['"', "'", '`'].includes(char)) {
        // Quote chars start a new value
        state.currentQuoter = char;
        // A new value has started, we no longer could be done on an invalid char
        state.couldBeDone = false;
        continue stringEnumTokenLoop;
      }
      if (['~'].includes(char)) {
        // Deprecated string enum values are wrapped with strikethrough
        state.currentQuoterWrappers.push(char);
        continue stringEnumTokenLoop;
      }
      // If we are at the very start we should just assume our heuristic found something silly
      // and bail, 0 valid characters is skip-able
      if (state.position === 1) {
        return null;
      }
      // If the last thing we parsed _could_ have been a termination character
      // let's assume an invalid character here confirms that.
      if (state.couldBeDone) {
        break stringEnumTokenLoop;
      }
      // Anything else is unexpected
      throw new Error(
        `Unexpected token while extracting string enum. Token: ${char}\nContext: "${
          locatorMatch[1]
        }"\n${' '.repeat(9 + state.position)}^`,
      );
    }
  }

  // Reached the end of the description, we should check
  // if we are in a clean state (not inside a quote).
  // If so we're good, if not hard error
  if (state.currentQuoter || state.currentValue) {
    throw new Error(
      `Unexpected early termination of token sequence while extracting string enum, did you forget to close a quote?\nContext: ${locatorMatch[1]}`,
    );
  }

  // No options we should just bail, can't have a string enum with 0 options
  if (!state.values.length) {
    return null;
  }

  return state.values.map((value) => ({
    value,
    description: '',
  }));
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
    new RegExp(`${prefix} \`([^\`]+?)\`:?(\. |\.\n|\n|$)`),
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
  let typedKeys: null | TypedKeyList = null;
  if (list) {
    try {
      typedKeys = convertListToTypedKeys(tokens);
    } catch {}
  }

  if (parsedDescription.trim().startsWith('|')) {
    throw new Error(
      `Found a return type declaration that appears to be declaring a type union (A | B) but in the incorrect format. Type unions must be fully enclosed in backticks. For instance, instead of \`A\` | \`B\` you should specify \`A | B\`.\nSpecifically this error was encountered here:\n  "${rawDescription
        .trim()
        .slice(0, 100)}"...`,
    );
  }

  return {
    parsedDescription: parsedDescription.trim(),
    parsedReturnType: rawTypeToTypeInformation(rawReturnType, parsedDescription, typedKeys),
  };
};

export interface JoinTokenOptions {
  parseCodeFences?: boolean;
}

// NOTE: This method obliterates code fences
export const safelyJoinTokens = (tokens: Token[], options: JoinTokenOptions = {}) => {
  let joinedContent = '';
  let listLevel = -1;
  for (const tokenToCheck of tokens) {
    if (tokenToCheck.children !== null && tokenToCheck.type === 'inline') {
      joinedContent += safelyJoinTokens(tokenToCheck.children, options);
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
        'ordered_list_open',
        'ordered_list_close',
        'list_item_open',
        'list_item_close',
        'em_open',
        'em_close',
        'fence',
        's_open',
        's_close',
        'blockquote_open',
        'blockquote_close',
        'html_block',
        'html_inline',
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
      case 'ordered_list_open':
        // If we are opening a new list inside a list we need to strip a new line from the last close paragraph
        if (listLevel > -1) {
          joinedContent = joinedContent.slice(0, joinedContent.length - 1);
        }
        listLevel += 1;
        break;
      case 'bullet_list_close':
      case 'ordered_list_close':
        // On close of a nested list, add an extra new line
        if (listLevel > -1) {
          joinedContent += '\n';
        }
        listLevel -= 1;
        break;
      case 'paragraph_open':
      case 'blockquote_close':
      case 'html_block':
        break;
      case 'html_inline':
        // Replace <br> elements with a newline
        if (tokenToCheck.content.match(/<br\s*\/?>/)) {
          joinedContent += '\n';
        }
        break;
      case 'fence':
        if (options.parseCodeFences) {
          joinedContent += `\`\`\`\n${tokenToCheck.content}\`\`\`\n\n`;
        }
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
  additionalTags: DocumentationTag[];
};

type TypedKeyList = {
  keys: TypedKey[];
  consumed: boolean;
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

const unconsumedTypedKeyList = <T extends TypedKey[] | null>(
  keys: T,
): T extends null ? null : TypedKeyList => {
  return keys
    ? {
        consumed: false,
        keys,
      }
    : (null as any);
};

export const consumeTypedKeysList = (list: TypedKeyList) => {
  if (list.consumed)
    throw new Error('Attempted to consume a typed keys list that has already been consumed');
  list.consumed = true;
  return list.keys;
};

const convertNestedListToTypedKeys = (list: List): TypedKey[] => {
  const keys: TypedKey[] = [];

  for (const item of list.items) {
    // If the current list would fail checks, but it has a nested list, assume that the nested list is the content we want
    // E.g.
    // * `foo` - string
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
    expect(targetToken.children!.length).to.be.at.least(
      1,
      'Expected token token to have at least 1 child for typed key extraction',
    );
    const keyToken = targetToken.children![0];
    expect(keyToken.type).to.equal(
      'code_inline',
      `Expected key token to be an inline code block but instead encountered "${keyToken.content}"`,
    );
    const typeAndDescriptionTokens = targetToken.children!.slice(1);
    const joinedContent = safelyJoinTokens(typeAndDescriptionTokens);

    let rawType = 'string';
    if (typeAndDescriptionTokens.length !== 0) {
      rawType = joinedContent.split('-')[0];
    }

    const rawDescription = joinedContent.substr(rawType.length);

    expect(rawDescription).not.to.match(
      / ?\(optional\) ?/i,
      'optionality for a typed key should be defined before the "-" and after the type',
    );

    const isRootOptional = / ?\(optional\) ?/.test(rawType);
    expect(rawType).not.to.match(
      / ?\(Optional\) ?/,
      'optionality should be defined with "(optional)", all lower case, no capital "O"',
    );
    const tagMatcher = /.+?((?: _(?:[^_]+?)_)+)/g;
    const tagMatch = tagMatcher.exec(rawType);
    const cleanedType = rawType.replace(/ ?\(optional\) ?/i, '').replace(/_.+?_/g, '');
    const subTypedKeys = item.nestedList ? convertNestedListToTypedKeys(item.nestedList) : null;
    const type = rawTypeToTypeInformation(
      cleanedType.trim(),
      rawDescription,
      unconsumedTypedKeyList(subTypedKeys),
    );

    keys.push({
      type,
      key: keyToken.content,
      description: rawDescription.trim().replace(/^- ?/, ''),
      required: !isRootOptional,
      additionalTags: tagMatch ? parseHeadingTags(tagMatch[1]) : [],
    });
  }

  return keys;
};

export const convertListToTypedKeys = (listTokens: Token[]): TypedKeyList => {
  const list = getNestedList(listTokens);

  return unconsumedTypedKeyList(convertNestedListToTypedKeys(list));
};

export const findProcess = (tokens: Token[]): ProcessBlock => {
  for (const tk of tokens) {
    if (
      tk.type === 'inline' &&
      (tk.content.startsWith('Process') || tk.content.startsWith('Exported in'))
    ) {
      const ptks = tk.children!.slice(2, tk.children!.length - 1);
      const procs: ProcessBlock = {
        main: false,
        renderer: false,
        utility: false,
        exported: !ptks.some(
          (ptk) => ptk.type === 'text' && ptk.content.startsWith('This class is not exported'),
        ),
      };
      for (const ptk of ptks) {
        if (ptk.type !== 'text') continue;
        if (ptk.content === 'Main') procs.main = true;
        if (ptk.content === 'Renderer') procs.renderer = true;
        if (ptk.content === 'Utility') procs.utility = true;
      }
      return procs;
    }
  }
  return { main: true, renderer: true, utility: true, exported: false };
};

export const slugifyHeading = (heading: string): string => {
  return heading
    .replace(/[^A-Za-z0-9 \-]/g, '')
    .replace(/ /g, '-')
    .toLowerCase();
};
