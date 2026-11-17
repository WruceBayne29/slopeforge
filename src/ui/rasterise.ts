import type { Figure } from '../io/report';

/**
 * Renders an on-screen SVG drawing to a PNG so it can be placed in the PDF report. Anything
 * marked `data-export="skip"` (editing handles) is left out.
 */
export function rasterise(svg: SVGSVGElement, scale = 3): Promise<Figure> {
  const box = svg.viewBox.baseVal;
  const width = box.width || svg.clientWidth;
  const height = box.height || svg.clientHeight;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-export="skip"]').forEach((node) => node.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is not available'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width, height });
    };
    image.onerror = () => reject(new Error('Could not render the drawing'));
    image.src = source;
  });
}
