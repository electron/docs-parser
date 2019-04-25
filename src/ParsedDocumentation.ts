export type PossibleStringValue = {
  value: string;
  description: string;
};

export type DetailedType = (
  | {
      type: TypeInformation[];
    }
  | {
      type: 'Function';
      parameters: MethodParameterDocumentation[];
      returns: TypeInformation | null;
    }
  | {
      type: 'Object';
      properties: PropertyDocumentationBlock[];
    }
  | {
      type: 'String';
      possibleValues: PossibleStringValue[] | null;
    }
  | {
      type: string;
    }) & {
  innerTypes?: TypeInformation[];
};

export type TypeInformation = {
  collection: boolean;
} & DetailedType;

export type MethodParameterDocumentation = {
  name: string;
  description: string;
  required: boolean;
} & TypeInformation;

export type EventParameterDocumentation = {
  name: string;
  description: string;
} & TypeInformation;

export type DocumentationBlock = {
  name: string;
  description: string;
};

export type MethodDocumentationBlock = DocumentationBlock & {
  signature: string;
  parameters: MethodParameterDocumentation[];
  returns: TypeInformation | null;
};
export type EventDocumentationBlock = DocumentationBlock & {
  parameters: EventParameterDocumentation[];
};
export type PropertyDocumentationBlock = DocumentationBlock & {
  required: boolean;
} & TypeInformation;

export type BaseDocumentationContainer = {
  name: string;
  extends?: string;
  description: string;
  version: string;
  slug: string;
  websiteUrl: string;
  repoUrl: string;
};

export type ModuleDocumentationContainer = {
  type: 'Module';
  process: {
    main: boolean;
    renderer: boolean;
  };
  methods: MethodDocumentationBlock[];
  events: EventDocumentationBlock[];
  properties: PropertyDocumentationBlock[];
} & BaseDocumentationContainer;

export type StructureDocumentationContainer = {
  type: 'Structure';
  properties: PropertyDocumentationBlock[];
  extends?: string;
} & BaseDocumentationContainer;

export type ClassDocumentationContainer = {
  type: 'Class';
  process: {
    main: boolean;
    renderer: boolean;
  };
  constructorMethod: Pick<MethodDocumentationBlock, 'signature' | 'parameters'> | null;
  instanceName: string;
  staticMethods: MethodDocumentationBlock[];
  staticProperties: PropertyDocumentationBlock[];
  instanceMethods: MethodDocumentationBlock[];
  instanceEvents: EventDocumentationBlock[];
  instanceProperties: PropertyDocumentationBlock[];
} & BaseDocumentationContainer;

export type ParsedDocumentationResult = (
  | ModuleDocumentationContainer
  | ClassDocumentationContainer
  | StructureDocumentationContainer)[];

export class ParsedDocumentation {
  private repr: ParsedDocumentationResult = [];

  public addStructure(struct: StructureDocumentationContainer) {
    this.repr.push(struct);
  }

  public addModuleOrClass(
    ...apiContainers: (ModuleDocumentationContainer | ClassDocumentationContainer)[]
  ) {
    this.repr.push(...apiContainers);
  }

  public getJSON(): ParsedDocumentationResult {
    return this.repr.filter(container => {
      if (container.type !== 'Module') return true;

      return container.events.length + container.methods.length + container.properties.length > 0;
    });
  }
}
