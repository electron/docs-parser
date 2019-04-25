export declare type PossibleStringValue = {
  value: string;
  description: string;
};
export declare type DetailedStringType = {
  type: 'String';
  possibleValues: PossibleStringValue[] | null;
};
export declare type DetailedObjectType = {
  type: 'Object';
  properties: PropertyDocumentationBlock[];
};
export declare type DetailedFunctionType = {
  type: 'Function';
  parameters: MethodParameterDocumentation[];
  returns: TypeInformation | null;
};
export declare type DetailedType = (
  | {
      type: TypeInformation[];
    }
  | DetailedFunctionType
  | DetailedObjectType
  | DetailedStringType
  | {
      type: string;
    }) & {
  innerTypes?: TypeInformation[];
};
export declare type TypeInformation = {
  collection: boolean;
} & DetailedType;
export declare type MethodParameterDocumentation = {
  name: string;
  description: string;
  required: boolean;
} & TypeInformation;
export declare type EventParameterDocumentation = {
  name: string;
  description: string;
  required: boolean;
} & TypeInformation;
export declare type DocumentationBlock = {
  name: string;
  description: string;
};
export declare type MethodDocumentationBlock = DocumentationBlock & {
  signature: string;
  parameters: MethodParameterDocumentation[];
  returns: TypeInformation | null;
};
export declare type EventDocumentationBlock = DocumentationBlock & {
  parameters: EventParameterDocumentation[];
};
export declare type PropertyDocumentationBlock = DocumentationBlock & {
  required: boolean;
} & TypeInformation;
export declare type BaseDocumentationContainer = {
  name: string;
  extends?: string;
  description: string;
  version: string;
  slug: string;
  websiteUrl: string;
  repoUrl: string;
};
export declare type ModuleDocumentationContainer = {
  type: 'Module';
  process: {
    main: boolean;
    renderer: boolean;
  };
  methods: MethodDocumentationBlock[];
  events: EventDocumentationBlock[];
  properties: PropertyDocumentationBlock[];
  constructorMethod?: undefined;
  instanceMethods?: undefined;
  instanceEvents?: undefined;
  instanceProperties?: undefined;
  staticProperties?: undefined;
  staticMethods?: undefined;
} & BaseDocumentationContainer;
export declare type StructureDocumentationContainer = {
  type: 'Structure';
  properties: PropertyDocumentationBlock[];
  constructorMethod?: undefined;
  methods?: undefined;
  events?: undefined;
  instanceMethods?: undefined;
  instanceEvents?: undefined;
  instanceProperties?: undefined;
  staticProperties?: undefined;
  staticMethods?: undefined;
  extends?: string;
} & BaseDocumentationContainer;
export declare type ClassDocumentationContainer = {
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
  methods?: undefined;
  events?: undefined;
  properties?: undefined;
} & BaseDocumentationContainer;
export declare type ElementDocumentationContainer = {
  type: 'Element';
  process: {
    main: boolean;
    renderer: boolean;
  };
  constructorMethod?: undefined;
  methods: MethodDocumentationBlock[];
  events: EventDocumentationBlock[];
  properties: PropertyDocumentationBlock[];
  instanceMethods?: undefined;
  instanceEvents?: undefined;
  instanceProperties?: undefined;
  staticProperties?: undefined;
  staticMethods?: undefined;
} & BaseDocumentationContainer;
export declare type ParsedDocumentationResult = (
  | ModuleDocumentationContainer
  | ClassDocumentationContainer
  | StructureDocumentationContainer
  | ElementDocumentationContainer)[];

export class ParsedDocumentation {
  private repr: ParsedDocumentationResult = [];

  public addStructure(struct: StructureDocumentationContainer) {
    this.repr.push(struct);
  }

  public addModuleOrClassOrElement(
    ...apiContainers: (
      | ModuleDocumentationContainer
      | ClassDocumentationContainer
      | ElementDocumentationContainer)[]
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
