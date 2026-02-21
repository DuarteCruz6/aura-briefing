import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

const STORY_POINTS = [
  { lat: 53.35, lon: -6.26, label: "Dublin" },
  { lat: 40.71, lon: -74.01, label: "New York" },
  { lat: 51.51, lon: -0.13, label: "London" },
  { lat: 35.68, lon: 139.69, label: "Tokyo" },
  { lat: -33.87, lon: 151.21, label: "Sydney" },
  { lat: 48.86, lon: 2.35, label: "Paris" },
  { lat: 19.43, lon: -99.13, label: "Mexico City" },
];

function latLonToXY(lat: number, lon: number, rotation: number, r: number, cx: number, cy: number) {
  const phi = (lat * Math.PI) / 180;
  const lambda = ((lon + rotation) * Math.PI) / 180;
  const x = cx + r * Math.cos(phi) * Math.sin(lambda);
  const y = cy - r * Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lambda);
  return { x, y, visible: z > 0 };
}

export function RotatingGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotation = useRef(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 160;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;
    const r = 60;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      rotation.current += 0.3;

      // Globe outline
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "hsla(210, 100%, 56%, 0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        const phi = (lat * Math.PI) / 180;
        const ry = r * Math.cos(phi);
        const yOff = cy - r * Math.sin(phi);
        ctx.ellipse(cx, yOff, ry, ry * 0.15, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "hsla(210, 100%, 56%, 0.08)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = 0; lon < 180; lon += 30) {
        ctx.beginPath();
        const lambda = ((lon + rotation.current) * Math.PI) / 180;
        for (let lat = -90; lat <= 90; lat += 2) {
          const phi = (lat * Math.PI) / 180;
          const x = cx + r * Math.cos(phi) * Math.sin(lambda);
          const y = cy - r * Math.sin(phi);
          const z = Math.cos(phi) * Math.cos(lambda);
          if (z > 0) {
            if (lat === -90 || Math.cos(((lat - 2) * Math.PI) / 180) * Math.cos(lambda) <= 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.strokeStyle = "hsla(210, 100%, 56%, 0.08)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Story points
      STORY_POINTS.forEach((p, i) => {
        const { x, y, visible } = latLonToXY(p.lat, p.lon, rotation.current, r, cx, cy);
        if (!visible) return;

        // Glow
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 8);
        grad.addColorStop(0, "hsla(210, 100%, 56%, 0.6)");
        grad.addColorStop(1, "hsla(210, 100%, 56%, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Dot
        const pulse = 1.5 + Math.sin(Date.now() / 500 + i) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, pulse, 0, Math.PI * 2);
        ctx.fillStyle = "hsl(210, 100%, 56%)";
        ctx.fill();
      });

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      <canvas ref={canvasRef} className="w-[160px] h-[160px]" />
      <p className="text-[9px] text-muted-foreground text-center mt-1 tracking-wider uppercase">Live Sources</p>
    </motion.div>
  );
}
