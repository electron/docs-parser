import { expect } from 'chai';
import Token from 'markdown-it/lib/token';

import {
  headingsAndContent,
  findNextList,
  convertListToTypedKeys,
  findContentAfterList,
  safelyJoinTokens,
  HeadingContent,
  extractReturnType,
  findContentAfterHeadingClose,
  StripReturnTypeBehavior,
} from './markdown-helpers';
import {
  MethodDocumentationBlock,
  PropertyDocumentationBlock,
  EventDocumentationBlock,
} from './ParsedDocumentation';

export const _headingToMethodBlock = (
  heading: HeadingContent | null,
): MethodDocumentationBlock | null => {
  if (!heading) return null;

  const methodStringRegexp = /`(?:.+\.)?(.+?)(\(.*?\))`/g;
  const methodStringMatch = methodStringRegexp.exec(heading.heading)!;
  methodStringRegexp.lastIndex = -1;
  expect(heading.heading).to.match(
    methodStringRegexp,
    'each method should have a code blocked method name',
  );
  const [, methodString, methodSignature] = methodStringMatch;

  let parameters: MethodDocumentationBlock['parameters'] = [];
  if (methodSignature !== '()') {
    // If we have parameters we need to find the list of typed keys
    const list = findNextList(heading.content)!;
    expect(list).to.not.equal(
      null,
      `Method ${heading.heading} has at least one parameter but no parameter type list`,
    );
    parameters = convertListToTypedKeys(list).map(typedKey => ({
      name: typedKey.key,
      description: typedKey.description,
      required: typedKey.required,
      ...typedKey.type,
    }));
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
  };
};

export const _headingToPropertyBlock = (heading: HeadingContent): PropertyDocumentationBlock => {
  const propertyStringRegexp = /`(?:.+\.)?(.+?)`/g;
  const propertyStringMatch = propertyStringRegexp.exec(heading.heading)!;
  propertyStringRegexp.lastIndex = -1;
  expect(heading.heading).to.match(
    propertyStringRegexp,
    'each property should have a code blocked property name',
  );
  const [, propertyString] = propertyStringMatch;

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
    required: /\(optional\)/i.test(parsedDescription),
    ...parsedReturnType!,
  };
};

export const _headingToEventBlock = (heading: HeadingContent): EventDocumentationBlock => {
  const eventNameRegexp = /^Event: '(.+)'/g;
  const eventNameMatch = eventNameRegexp.exec(heading.heading)!;
  eventNameRegexp.lastIndex = -1;
  expect(heading.heading).to.match(eventNameRegexp, 'each event should have a quoted event name');
  const [, eventName] = eventNameMatch;

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
      const typedKeys = convertListToTypedKeys(list);
      parameters = typedKeys.map(typedKey => ({
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
