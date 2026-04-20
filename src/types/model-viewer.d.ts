// Typ-Deklaration fuer Google model-viewer Web Component
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          ar?: boolean;
          'ar-modes'?: string;
          'camera-controls'?: boolean;
          'touch-action'?: string;
          'auto-rotate'?: boolean;
          'shadow-intensity'?: string;
          'environment-image'?: string;
          exposure?: string;
          poster?: string;
        },
        HTMLElement
      >;
    }
  }
}
