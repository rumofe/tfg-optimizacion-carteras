/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'react-simple-maps' {
  import { ReactNode, CSSProperties, SVGProps, MouseEvent } from 'react';

  export interface GeoFeature {
    rsmKey: string;
    id: string | number;
    properties: Record<string, string>;
    [k: string]: any;
  }

  export function ComposableMap(props: {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }): JSX.Element;

  export function Geographies(props: {
    geography: string | object;
    children: (ctx: { geographies: GeoFeature[] }) => ReactNode;
  }): JSX.Element;

  export function Geography(props: {
    key?: string | number;
    geography: GeoFeature;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: SVGProps<SVGPathElement> & { outline?: string; cursor?: string };
      hover?: SVGProps<SVGPathElement> & { outline?: string; cursor?: string };
      pressed?: SVGProps<SVGPathElement> & { outline?: string; cursor?: string };
    };
    onMouseMove?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: () => void;
    onClick?: (event: MouseEvent<SVGPathElement>) => void;
  }): JSX.Element;

  export function ZoomableGroup(props: {
    zoom?: number;
    center?: [number, number];
    children?: ReactNode;
    [k: string]: any;
  }): JSX.Element;
}
