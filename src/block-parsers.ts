import { expect } from 'chai';
import Token from 'markdown-it/lib/token';

import {
  parseHeadingTags,
  headingsAndContent,
  findNextList,
  convertListToTypedKeys,
  findContentAfterList,
  safelyJoinTokens,
  HeadingContent,
  extractReturnType,
  findContentAfterHeadingClose,
  StripReturnTypeBehavior,
  consumeTypedKeysList,
} from './markdown-helpers';
import {
  MethodDocumentationBlock,
  PropertyDocumentationBlock,
  EventDocumentationBlock,
} from './ParsedDocumentation';

type GuessedParam = {
  name: string;
  optional: boolean;
};

export const guessParametersFromSignature = (signature: string) => {
  expect(signature).to.match(
    /^\(([a-zA-Z,\[\] ]+|(\.\.\.[^\.])|([a-zA-Z][0-9]))+\)$/g,
    'signature should be a bracket wrapped group of parameters',
  );
  const justParams = signature.slice(1, signature.length - 1);
  let optionalDepth = 0;
  const params: GuessedParam[] = [];
  let currentParam = '';
  let currentOptional = false;
  const maybePushCurrent = () => {
    const trimmed = currentParam.trim();
    if (trimmed) {
      params.push({
        name: trimmed,
        optional: currentOptional,
      });
      currentParam = '';
    }
  };
  for (let i = 0; i < justParams.length; i++) {
    const char = justParams[i];
    switch (char) {
      case '[':
        optionalDepth++;
        break;
      case ']':
        maybePushCurrent();
        optionalDepth--;
        expect(optionalDepth).to.be.gte(
          0,
          `optional depth should never be negative, you have too many "]" characters in your signature: "${signature}"`,
        );
        break;
      case ',':
        maybePushCurrent();
        break;
      default:
        if (!currentParam.trim()) currentOptional = optionalDepth > 0;
        currentParam += char;
    }
  }
  maybePushCurrent();
  expect(optionalDepth).to.equal(
    0,
    `optional depth should return to 0, you have mismateched [ and ] characters in your signature: "${signature}"`,
  );
  return params;
};

export const _headingToMethodBlock = (
  heading: HeadingContent | null,
): MethodDocumentationBlock | null => {
  if (!heading) return null;

  const methodStringRegexp = /`(?:.+\.)?(.+?)(\(.*?\))`((?: _[^_]+?_)*)/g;
  const methodStringMatch = methodStringRegexp.exec(heading.heading)!;
  methodStringRegexp.lastIndex = -1;
  expect(heading.heading).to.match(
    methodStringRegexp,
    'each method should have a code blocked method name',
  );
  const [, methodString, methodSignature, headingTags] = methodStringMatch;

  let parameters: MethodDocumentationBlock['parameters'] = [];
  if (methodSignature !== '()') {
    const guessedParams = guessParametersFromSignature(methodSignature);
    // If we have parameters we need to find the list of typed keys
    const list = findNextList(heading.content)!;
    expect(list).to.not.equal(
      null,
      `Method ${heading.heading} has at least one parameter but no parameter type list`,
    );
    parameters = consumeTypedKeysList(convertListToTypedKeys(list)).map(typedKey => ({
      name: typedKey.key,
      description: typedKey.description,
      required: typedKey.required,
      ...typedKey.type,
    }));
    expect(parameters).to.have.lengthOf(
      guessedParams.length,
      `should have the same number of documented parameters as we have in the method signature: "${methodSignature}"`,
    );
    for (let i = 0; i < parameters.length; i++) {
      expect(parameters[i].required).to.equal(
        !guessedParams[i].optional,
        `the optionality of a parameter in the signature should match the documented optionality in the parameter description: "${methodString}${methodSignature}", while parsing parameter: "${parameters[i].name}"`,
      );
    }
  }

  const returnTokens =
    methodSignature === '()'
      ? findContentAfterHeadingClose(heading.content)
      : findContentAfterList(heading.content, true);

  const { parsedDescription, parsedReturnType } = extractReturnType(returnTokens);

  return {
    name: methodString,
    signature: methodSignature,
    description: parsedDescription,
    parameters,
    returns: parsedReturnType,
    additionalTags: parseHeadingTags(headingTags),
  };
};

export const _headingToPropertyBlock = (heading: HeadingContent): PropertyDocumentationBlock => {
  const propertyStringRegexp = /`(?:.+\.)?(.+?)`((?: _[^_]+?_)*)/g;
  const propertyStringMatch = propertyStringRegexp.exec(heading.heading)!;
  propertyStringRegexp.lastIndex = -1;
  expect(heading.heading).to.match(
    propertyStringRegexp,
    'each property should have a code blocked property name',
  );
  const [, propertyString, headingTags] = propertyStringMatch;

  const { parsedDescription, parsedReturnType } = extractReturnType(
    findContentAfterHeadingClose(heading.content),
    StripReturnTypeBehavior.DO_NOT_STRIP,
    'An?',
  );

  expect(parsedReturnType).to.not.equal(
    null,
    `Property ${heading.heading} should have a declared type but it does not`,
  );

  return {
    name: propertyString,
    description: parsedDescription,
    required: !/\(optional\)/i.test(parsedDescription),
    additionalTags: parseHeadingTags(headingTags),
    ...parsedReturnType!,
  };
};

export const _headingToEventBlock = (heading: HeadingContent): EventDocumentationBlock => {
  const eventNameRegexp = /^Event: '(.+)'((?: _[^_]+?_)*)/g;
  const eventNameMatch = eventNameRegexp.exec(heading.heading)!;
  eventNameRegexp.lastIndex = -1;
  expect(heading.heading).to.match(eventNameRegexp, 'each event should have a quoted event name');
  const [, eventName, headingTags] = eventNameMatch;

  expect(eventName).to.not.equal('', 'should have a non-zero-length event name');

  const description = safelyJoinTokens(findContentAfterList(heading.content, true));

  let parameters: EventDocumentationBlock['parameters'] = [];
  if (
    safelyJoinTokens(findContentAfterHeadingClose(heading.content))
      .trim()
      .startsWith('Returns:')
  ) {
    const list = findNextList(heading.content);
    if (list) {
      parameters = consumeTypedKeysList(convertListToTypedKeys(list)).map(typedKey => ({
        name: typedKey.key,
        description: typedKey.description,
        ...typedKey.type,
        required: true,
      }));
    }
  }

  return {
    name: eventName,
    description,
    parameters,
    additionalTags: parseHeadingTags(headingTags),
  };
};

export const parseMethodBlocks = (tokens: Token[] | null): MethodDocumentationBlock[] => {
  if (!tokens) return [];

  return headingsAndContent(tokens).map(heading => _headingToMethodBlock(heading)!);
};

export const parsePropertyBlocks = (tokens: Token[] | null): PropertyDocumentationBlock[] => {
  if (!tokens) return [];

  return headingsAndContent(tokens).map(_headingToPropertyBlock);
};

export const parseEventBlocks = (tokens: Token[] | null): EventDocumentationBlock[] => {
  if (!tokens) return [];

  return headingsAndContent(tokens).map(_headingToEventBlock);
};
