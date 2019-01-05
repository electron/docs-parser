import { expect } from 'chai';

import {
  MarkdownTokens,
  headingsAndContent,
  findNextList,
  convertListToTypedKeys,
  findContentAfterList,
  safelyJoinTokens,
  HeadingContent,
} from './markdown-helpers';
import {
  MethodDocumentationBlock,
  PropertyDocumentationBlock,
  EventDocumentationBlock,
} from './ParsedDocumentation';

export const _headingToMethodBlock = (heading: HeadingContent | null) => {
  if (!heading) return null;

  const methodStringMatch = /`(?:.+\.)?(.+?)(\(.*?\))`/g.exec(heading.heading)!;
  // TODO: Remove
  console.log(heading.heading);
  expect(methodStringMatch).to.not.equal(
    null,
    'each method should have a code blocked method name',
  );
  const [, methodString, methodSignature] = methodStringMatch;

  let parameters: MethodDocumentationBlock['parameters'] = [];
  if (methodSignature !== '()') {
    // If we have parameters we need to find the list of typed keys
    if (methodString === 'onHeadersReceived') {
      (global as any).__debug = true;
    }
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
    (global as any).__debug = false;
  }

  return {
    name: methodString,
    signature: methodSignature,
    description: safelyJoinTokens(findContentAfterList(heading.content)),
    parameters,
  };
};

export const parseMethodBlocks = (tokens: MarkdownTokens | null): MethodDocumentationBlock[] => {
  if (!tokens) return [];

  const blocks: MethodDocumentationBlock[] = [];

  for (const methodHeading of headingsAndContent(tokens)) {
    blocks.push(_headingToMethodBlock(methodHeading)!);
  }

  return blocks;
};

export const parsePropertyBlocks = (
  tokens: MarkdownTokens | null,
): PropertyDocumentationBlock[] => {
  if (!tokens) return [];
  return [];
};

export const parseEventBlocks = (tokens: MarkdownTokens | null): EventDocumentationBlock[] => {
  if (!tokens) return [];
  return [];
};
