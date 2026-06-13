import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  width = 1.8,
  height = 45,
  displayValue = false
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          lineColor: "#000000",
          width: width,
          height: height,
          displayValue: displayValue,
          font: "monospace",
          fontSize: 12,
          margin: 4
        });
      } catch (error) {
        console.error("Failed to render barcode", error);
      }
    }
  }, [value, width, height, displayValue]);

  return (
    <div className="flex justify-center items-center overflow-hidden bg-white rounded-md p-1 border border-gray-100">
      <svg ref={svgRef} className="max-w-full" style={{ display: 'block' }} />
    </div>
  );
};
