declare module 'three/examples/jsm/exporters/GLTFExporter.js' {
  import { Object3D } from 'three';
  export class GLTFExporter {
    parse(
      input: Object3D,
      onCompleted: (result: ArrayBuffer | object) => void,
      onError: (error: unknown) => void,
      options?: { binary?: boolean },
    ): void;
  }
}

declare module 'three/examples/jsm/loaders/GLTFLoader.js' {
  import { Group, Loader } from 'three';
  interface GLTF {
    scene: Group;
    scenes: Group[];
    animations: unknown[];
    cameras: unknown[];
    asset: object;
  }
  export class GLTFLoader extends Loader {
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: unknown) => void,
    ): void;
  }
}
