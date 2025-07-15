import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import useCanvasChart from '../hooks/useCanvasChart';

const CanvasAreaChart = ({
  data = [],
  width = 1200,
  height = 350,
  margin = { top: 20, right: 30, bottom: 40, left: 60 },
  areas = [],
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
  animate = true,
  stacked = false,
  opacity = 0.6,
  strokeWidth = 2,
  className = ''
}) => {
  const tooltipRef = useRef(null);
  const hoverDataRef = useRef(null);
  
  // Références pour les échelles FIXES pour éviter le scintillement
  const fixedScalesRef = useRef(null);
  const domainRef = useRef({ x: null, y: null });
  const animationProgressRef = useRef(0);

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
    animate: false, // Géré manuellement pour éviter le scintillement
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
      })).filter(d => d.value != null && !isNaN(d.value) && d.time)
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

  // Création d'échelles FIXES pour éviter le scintillement
  const createFixedScales = useCallback(() => {
    if (!stackedData.length || !data.length) return null;

    const allValues = stacked 
      ? stackedData.flatMap(area => area.data.map(d => d.y1 || d.value))
      : stackedData.flatMap(area => area.data.map(d => d.value));
    const timeValues = data.map(d => d.time);

    if (!timeValues.length || !allValues.length) return null;

    // Créer des domaines FIXES
    const xDomain = timeValues;
    const yMax = d3.max(allValues);
    const yDomain = [0, yMax * 1.1];

    // Vérifier si les domaines ont changé significativement (seuil plus élevé)
    const currentDomain = { 
      x: `${xDomain[0]}-${xDomain[xDomain.length - 1]}`, 
      y: `${yDomain[0]}-${yDomain[1]}` 
    };

    // Ne recréer les échelles que si le domaine change vraiment
    if (!fixedScalesRef.current || 
        domainRef.current.x !== currentDomain.x ||
        Math.abs(parseFloat(domainRef.current.y?.split('-')[1] || 0) - yDomain[1]) > yDomain[1] * 0.2) {
      
      const xScale = d3.scalePoint()
        .domain(xDomain)
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

      const yScale = d3.scaleLinear()
        .domain(yDomain)
        .range([height - margin.top - margin.bottom, 0])
        .nice();

      fixedScalesRef.current = { x: xScale, y: yScale };
      domainRef.current = currentDomain;
    }

    return fixedScalesRef.current;
  }, [stackedData, data, width, height, margin, stacked]);

  // Fonction de dessin principal avec animation fluide
  const drawChart = useCallback((progress = 1) => {
    const context = setupCanvas();
    if (!context || !stackedData.length) return;

    const scales = createFixedScales();
    if (!scales) return;

    // Effacer le canvas
    context.clearRect(0, 0, width, height);

    const innerHeight = height - margin.top - margin.bottom;

    // Dessiner la grille avec les échelles FIXES
    drawGrid(context, scales);

    // Dessiner les axes avec les échelles FIXES
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

      // Animation: limiter les données affichées selon le progrès
      const animatedData = animate ? 
        validData.slice(0, Math.ceil(validData.length * progress)) : 
        validData;

      if (animatedData.length < 2) return;

      // Créer le générateur d'aire
      const area = d3.area()
        .x(d => scales.x(d.time))
        .y0(d => stacked ? scales.y(d.y0 || 0) : innerHeight)
        .y1(d => scales.y(stacked ? (d.y1 || d.value) : d.value))
        .curve(d3.curveCardinal.tension(0.3))
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

      // Dessiner la ligne de contour
      context.strokeStyle = areaData.color;
      context.lineWidth = strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.globalAlpha = 0.8;

      // Ligne supérieure
      const line = d3.line()
        .x(d => scales.x(d.time))
        .y(d => scales.y(stacked ? (d.y1 || d.value) : d.value))
        .curve(d3.curveCardinal.tension(0.3))
        .context(context);

      context.beginPath();
      line(animatedData);
      context.stroke();

      context.globalAlpha = 1;
    });

    context.restore();
  }, [setupCanvas, stackedData, width, height, margin, drawGrid, drawAxes, stacked, opacity, strokeWidth, createFixedScales, animate]);

  // Gestion du survol pour les tooltips
  const handleMouseMove = useCallback((event) => {
    if (!canvasRef.current || !stackedData.length || !fixedScalesRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - margin.left;

    // Trouver le point le plus proche
    const timeValues = data.map(d => d.time);
    const xScale = fixedScalesRef.current.x;

    // Find the closest point
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
        // Animation fluide
        const duration = 1000;
        const startTime = performance.now();
        
        const animateFrame = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Easing function (ease-out-cubic)
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          
          drawChart(easedProgress);
          animationProgressRef.current = easedProgress;

          if (progress < 1) {
            requestAnimationFrame(animateFrame);
          }
        };

        requestAnimationFrame(animateFrame);
      } else {
        // Rendu direct sans animation
        const rafId = requestAnimationFrame(() => drawChart(1));
        return () => cancelAnimationFrame(rafId);
      }
    }
  }, [stackedData, drawChart, animate]);

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