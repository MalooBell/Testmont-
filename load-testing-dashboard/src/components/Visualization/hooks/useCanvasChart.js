import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';

export const useCanvasChart = ({
  data = [],
  width = 2000,
  height = 400,
  margin = { top: 20, right: 3, bottom: 40, left: 5 },
  animate = true,
  smoothCurve = true
}) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const animationRef = useRef(null);
  const previousDataRef = useRef([]);
  const scalesRef = useRef({});

  // Configuration du canvas haute résolution
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const context = canvas.getContext('2d');
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Configuration haute résolution
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.scale(devicePixelRatio, devicePixelRatio);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    contextRef.current = context;
    return context;
  }, [width, height]);

  // Création des échelles D3
  const createScales = useCallback((data) => {
    if (!data.length) return {};

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Échelle temporelle pour l'axe X
    const xScale = d3.scalePoint()
      .domain(data.map(d => d.time))
      .range([0, innerWidth])
      .padding(0.1);

    // Échelles pour les différentes métriques
    const scales = { x: xScale };

    // Détection automatique des champs numériques
    const numericFields = Object.keys(data[0] || {}).filter(key => 
      key !== 'time' && typeof data[0][key] === 'number'
    );

    numericFields.forEach(field => {
      const values = data.map(d => d[field]).filter(v => v != null);
      if (values.length > 0) {
        const extent = d3.extent(values);
        scales[field] = d3.scaleLinear()
          .domain([Math.min(0, extent[0]), extent[1] * 1.1])
          .range([innerHeight, 0])
          .nice();
      }
    });

    scalesRef.current = scales;
    return scales;
  }, [width, height, margin]);

  // Fonction de dessin de la grille
  const drawGrid = useCallback((context, scales) => {
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    context.save();
    context.translate(margin.left, margin.top);
    context.strokeStyle = '#f0f0f0';
    context.lineWidth = 1;

    // Grille verticale
    if (scales.x) {
      const ticks = scales.x.domain().filter((_, i) => i % Math.ceil(scales.x.domain().length / 8) === 0);
      ticks.forEach(tick => {
        const x = scales.x(tick);
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, innerHeight);
        context.stroke();
      });
    }

    // Grille horizontale (utilise la première échelle Y trouvée)
    const yScaleKey = Object.keys(scales).find(key => key !== 'x');
    if (yScaleKey && scales[yScaleKey]) {
      const yScale = scales[yScaleKey];
      const ticks = yScale.ticks(6);
      ticks.forEach(tick => {
        const y = yScale(tick);
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(innerWidth, y);
        context.stroke();
      });
    }

    context.restore();
  }, [width, height, margin]);

  // Fonction de dessin des axes
  const drawAxes = useCallback((context, scales) => {
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    context.save();
    context.translate(margin.left, margin.top);
    context.strokeStyle = '#374151';
    context.fillStyle = '#374151';
    context.font = '12px Inter, sans-serif';
    context.lineWidth = 1;

    // Axe X
    context.beginPath();
    context.moveTo(0, innerHeight);
    context.lineTo(innerWidth, innerHeight);
    context.stroke();

    // Labels axe X
    if (scales.x) {
      const ticks = scales.x.domain().filter((_, i) => i % Math.ceil(scales.x.domain().length / 6) === 0);
      context.textAlign = 'center';
      context.textBaseline = 'top';
      ticks.forEach(tick => {
        const x = scales.x(tick);
        context.fillText(tick, x, innerHeight + 10);
      });
    }

    // Axe Y
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, innerHeight);
    context.stroke();

    // Labels axe Y
    const yScaleKey = Object.keys(scales).find(key => key !== 'x');
    if (yScaleKey && scales[yScaleKey]) {
      const yScale = scales[yScaleKey];
      const ticks = yScale.ticks(6);
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      ticks.forEach(tick => {
        const y = yScale(tick);
        context.fillText(tick.toString(), -10, y);
      });
    }

    context.restore();
  }, [width, height, margin]);

  // Fonction utilitaire pour créer un générateur de ligne
  const createLineGenerator = useCallback((xScale, yScale) => {
    const line = d3.line()
      .x(d => xScale(d.time))
      .y(d => yScale(d.value))
      .context(contextRef.current);

    if (smoothCurve) {
      line.curve(d3.curveCardinal.tension(0.3));
    }

    return line;
  }, [smoothCurve]);

  // Fonction utilitaire pour créer un générateur d'aire
  const createAreaGenerator = useCallback((xScale, yScale) => {
    const innerHeight = height - margin.top - margin.bottom;
    
    const area = d3.area()
      .x(d => xScale(d.time))
      .y0(innerHeight)
      .y1(d => yScale(d.value))
      .context(contextRef.current);

    if (smoothCurve) {
      area.curve(d3.curveCardinal.tension(0.3));
    }

    return area;
  }, [smoothCurve, height, margin]);

  // Animation avec easing
  const animateChart = useCallback((drawFunction) => {
    if (!animate) {
      drawFunction(1);
      return;
    }

    const duration = 800;
    const startTime = performance.now();

    const animateFrame = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      drawFunction(easedProgress);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateFrame);
      }
    };

    animationRef.current = requestAnimationFrame(animateFrame);
  }, [animate]);

  // Nettoyage des animations
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // API publique du hook
  return {
    canvasRef,
    setupCanvas,
    createScales,
    drawGrid,
    drawAxes,
    createLineGenerator,
    createAreaGenerator,
    animateChart,
    context: contextRef.current,
    scales: scalesRef.current
  };
};

export default useCanvasChart;