import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import useCanvasChart from '../hooks/useCanvasChart';

const CanvasAreaChart = ({
  data = [],
  width = 1200,
  height = 350,
  margin = { top: 20, right: 50, bottom: 40, left: 60 },
  areas = [],
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
  animate = true,
  stacked = false,
  opacity = 0.6,
  strokeWidth = 2,
  className = '',
  useFixedScale = true
}) => {
  const tooltipRef = useRef(null);
  const hoverDataRef = useRef(null);
  
  // Références pour les échelles stables et repères fixes
  const scalesRef = useRef(null);
  const lastDataLengthRef = useRef(0);
  const lastDomainRef = useRef({ x: null, y: null });
  const fixedDomainRef = useRef({ x: null, y: null });

  const {
    canvasRef,
    setupCanvas,
    createScales,
    drawGrid,
    drawAxes,
    animateChart
  } = useCanvasChart({
    data,
    width,
    height,
    margin,
    animate: false,
    smoothCurve: true
  });

  // Préparation des données pour les aires multiples
  const processedData = useMemo(() => {
    if (!data.length || !areas.length) return [];

    return areas.map((area, index) => ({
      key: area.dataKey,
      name: area.name || area.dataKey,
      color: area.color || colors[index % colors.length],
      stackId: area.stackId || (stacked ? 'default' : index),
      data: data.map(d => ({
        time: d.time,
        value: d[area.dataKey] || 0
      })).filter(d => d.value != null && !isNaN(d.value))
    }));
  }, [data, areas, colors, stacked]);

  // Calcul des données empilées si nécessaire
  const stackedData = useMemo(() => {
    if (!stacked || !processedData.length) return processedData;

    // Grouper par stackId
    const stackGroups = d3.group(processedData, d => d.stackId);
    const result = [];

    stackGroups.forEach((group, stackId) => {
      let cumulativeData = new Map();
      
      group.forEach((series, seriesIndex) => {
        const stackedSeries = {
          ...series,
          data: series.data.map(d => {
            const prevValue = cumulativeData.get(d.time) || 0;
            const newValue = prevValue + d.value;
            cumulativeData.set(d.time, newValue);
            
            return {
              time: d.time,
              value: d.value,
              y0: prevValue,
              y1: newValue
            };
          })
        };
        
        result.push(stackedSeries);
      });
    });

    return result;
  }, [processedData, stacked]);

  // Création d'échelles stables avec repères fixes pour éviter le scintillement
  const createStableScales = useCallback(() => {
    if (!stackedData.length || !data.length) return null;

    // Filtrer les valeurs aberrantes pour des échelles plus stables
    const allValues = stacked 
      ? stackedData.flatMap(area => area.data.map(d => d.y1 || d.value).filter(v => v != null && isFinite(v) && v >= 0))
      : stackedData.flatMap(area => area.data.map(d => d.value).filter(v => v != null && isFinite(v) && v >= 0));
    const timeValues = data.map(d => d.time);

    if (!timeValues.length || !allValues.length) return null;

    // Créer des domaines avec repères fixes si activé
    const xDomain = timeValues;
    const yMax = d3.max(allValues);
    
    let finalYDomain;
    if (useFixedScale && fixedDomainRef.current.y) {
      // Utiliser le domaine fixe existant, mais l'étendre si nécessaire
      const [currentMin, currentMax] = fixedDomainRef.current.y;
      
      // Éviter les changements trop fréquents d'échelle (seuil de 20%)
      const shouldUpdateMax = yMax > currentMax * 1.2;
      
      finalYDomain = [
        currentMin,
        shouldUpdateMax ? yMax * 1.1 : currentMax
      ];
    } else {
      finalYDomain = [0, yMax * 1.1];
    }

    // Sauvegarder le domaine fixe
    if (useFixedScale) {
      fixedDomainRef.current.y = finalYDomain;
    }

    // Vérifier si les domaines ont changé significativement
    const currentDomain = { 
      x: xDomain.join(','), 
      y: `${finalYDomain[0]}-${finalYDomain[1]}` 
    };

    // Ne recréer les échelles que si nécessaire
    if (!scalesRef.current || 
        lastDataLengthRef.current !== data.length ||
        lastDomainRef.current.x !== currentDomain.x ||
        (!useFixedScale && Math.abs(parseFloat(lastDomainRef.current.y?.split('-')[1] || 0) - finalYDomain[1]) > finalYDomain[1] * 0.2)) {
      
      const xScale = d3.scalePoint()
        .domain(xDomain)
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

      const yScale = d3.scaleLinear()
        .domain(finalYDomain)
        .range([height - margin.top - margin.bottom, 0])
        .nice();

      scalesRef.current = { x: xScale, y: yScale };
      lastDataLengthRef.current = data.length;
      lastDomainRef.current = currentDomain;
    }

    return scalesRef.current;
  }, [stackedData, data, width, height, margin, stacked, useFixedScale]);

  // Fonction de dessin principal optimisée avec animations fluides
  const drawChart = useCallback((progress = 1) => {
    const context = setupCanvas();
    if (!context || !stackedData.length) return;

    const scales = createStableScales();
    if (!scales) return;

    // Effacer le canvas
    context.clearRect(0, 0, width, height);

    const innerHeight = height - margin.top - margin.bottom;

    // Dessiner la grille avec les échelles stables
    drawGrid(context, scales);

    // Dessiner les axes avec les échelles stables
    drawAxes(context, scales);

    // Dessiner les aires avec animation
    context.save();
    context.translate(margin.left, margin.top);

    stackedData.forEach((areaData, index) => {
      if (!areaData.data.length) return;

      // Filtrer les données valides
      const validData = areaData.data.filter(d => 
        d.time && 
        !isNaN(d.value) && 
        (stacked ? !isNaN(d.y0) && !isNaN(d.y1) : true)
      );

      if (validData.length < 2) return;

      // Animation : limiter les données affichées selon le progrès
      const animatedData = animate ? 
        validData.slice(0, Math.ceil(validData.length * progress)) : 
        validData;

      if (animatedData.length < 2) return;

      // Créer le générateur d'aire
      const area = d3.area()
        .x(d => scales.x(d.time))
        .y0(d => stacked ? scales.y(d.y0 || 0) : innerHeight)
        .y1(d => scales.y(stacked ? (d.y1 || d.value) : d.value))
        .curve(d3.curveCardinal.tension(0.2))
        .context(context);

      // Dessiner l'aire avec gradient
      const gradient = context.createLinearGradient(0, 0, 0, innerHeight);
      const colorWithOpacity = areaData.color + Math.floor(opacity * 255).toString(16).padStart(2, '0');
      gradient.addColorStop(0, colorWithOpacity);
      gradient.addColorStop(1, areaData.color + '10');

      context.fillStyle = gradient;
      context.beginPath();
      area(animatedData);
      context.fill();

      // Dessiner la ligne de contour avec animation
      context.strokeStyle = areaData.color;
      context.lineWidth = strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.globalAlpha = 0.8;

      // Ligne supérieure
      const line = d3.line()
        .x(d => scales.x(d.time))
        .y(d => scales.y(stacked ? (d.y1 || d.value) : d.value))
        .curve(d3.curveCardinal.tension(0.2))
        .context(context);

      context.beginPath();
      line(animatedData);
      context.stroke();

      context.globalAlpha = 1;
    });

    context.restore();
  }, [setupCanvas, stackedData, width, height, margin, drawGrid, drawAxes, stacked, opacity, strokeWidth, createStableScales, animate]);

  // Gestion du survol pour les tooltips
  const handleMouseMove = useCallback((event) => {
    if (!canvasRef.current || !stackedData.length || !scalesRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - margin.left;

    // Trouver le point le plus proche
    const timeValues = data.map(d => d.time);
    const xScale = scalesRef.current.x;

    // Find the closest point without using invert
    let closestTimeIndex = 0;
    let minDistance = Infinity;

    const domain = xScale.domain();
    domain.forEach((d, i) => {
      const distance = Math.abs(xScale(d) - x);
      if (distance < minDistance) {
        minDistance = distance;
        closestTimeIndex = i;
      }
    });
    const closestTime = timeValues[closestTimeIndex];

    if (closestTime && tooltipRef.current) {
      const tooltipData = stackedData.map(area => ({
        name: area.name,
        value: data[closestTimeIndex]?.[area.key] || 0,
        color: area.color
      }));

      hoverDataRef.current = { time: closestTime, data: tooltipData, x: event.clientX, y: event.clientY };
      
      // Afficher le tooltip
      tooltipRef.current.style.display = 'block';
      tooltipRef.current.style.left = `${event.clientX + 10}px`;
      tooltipRef.current.style.top = `${event.clientY - 10}px`;
      tooltipRef.current.innerHTML = `
        <div class="bg-white p-2 border border-gray-200 rounded shadow-lg text-sm">
          <div class="font-medium">${closestTime}</div>
          ${tooltipData.map(item => `
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full" style="background-color: ${item.color}"></div>
              <span>${item.name}: ${typeof item.value === 'number' ? item.value.toFixed(2) : item.value}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
  }, [canvasRef, stackedData, data, margin]);

  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
    hoverDataRef.current = null;
  }, []);

  // Effet pour redessiner avec animation fluide
  useEffect(() => {
    if (stackedData.length > 0) {
      if (animate) {
        animateChart(drawChart);
      } else {
        const rafId = requestAnimationFrame(() => drawChart(1));
        return () => cancelAnimationFrame(rafId);
      }
    }
  }, [stackedData, drawChart, animate, animateChart]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
        style={{ width, height }}
      />
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none z-50"
        style={{ display: 'none' }}
      />
      
      {/* Légende */}
      {stackedData.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-2 text-sm">
          {stackedData.map((area, index) => (
            <div key={area.key} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: area.color }}
              />
              <span className="text-gray-700">{area.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CanvasAreaChart;