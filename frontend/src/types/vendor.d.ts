// Module declaration for @changey/react-leaflet-markercluster which ships
// without TypeScript types.
declare module "@changey/react-leaflet-markercluster" {
  import { ComponentType, ReactNode } from "react";

  export interface MarkerClusterGroupProps {
    children?: ReactNode;
    [key: string]: unknown;
  }

  const MarkerClusterGroup: ComponentType<MarkerClusterGroupProps>;
  export default MarkerClusterGroup;
}
