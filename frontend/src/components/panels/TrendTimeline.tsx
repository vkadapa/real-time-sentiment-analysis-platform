import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { ProcessedMessage } from '../../types';

interface Props {
  lastMessage: ProcessedMessage | null;
}

interface DataPoint {
  timestamp: Date;
  sentiment: number;
}

const TrendTimeline: React.FC<Props> = ({ lastMessage }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const maxPoints = 50;

  useEffect(() => {
    if (lastMessage) {
      setData(prevData => {
        const newData = [
          ...prevData,
          {
            timestamp: new Date(),
            sentiment: lastMessage.sentiment_score
          }
        ].slice(-maxPoints);
        return newData;
      });
    }
  }, [lastMessage]);

  useEffect(() => {
    if (data.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 500;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.timestamp) as [Date, Date])
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([chartHeight, 0]);

    // Axes
    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat('%H:%M:%S') as any))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px');

    // Zero line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#6b7280')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4');

    // Area generator
    const area = d3.area<DataPoint>()
      .x(d => xScale(d.timestamp))
      .y0(yScale(0))
      .y1(d => yScale(d.sentiment))
      .curve(d3.curveMonotoneX);

    // Line generator
    const line = d3.line<DataPoint>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(d.sentiment))
      .curve(d3.curveMonotoneX);

    // Gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'sentiment-gradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.6);

    gradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#fbbf24')
      .attr('stop-opacity', 0.4);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ef4444')
      .attr('stop-opacity', 0.6);

    // Draw area
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#sentiment-gradient)')
      .attr('d', area);

    // Draw line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#667eea')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Draw dots
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.timestamp))
      .attr('cy', d => yScale(d.sentiment))
      .attr('r', 3)
      .attr('fill', d => d.sentiment >= 0 ? '#10b981' : '#ef4444')
      .attr('stroke', '#1e2330')
      .attr('stroke-width', 1);

  }, [data]);

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Real-Time Trend</h2>
        <span className="panel-badge neutral">{data.length} points</span>
      </div>
      <div className="panel-content" style={{ display: 'flex', justifyContent: 'center' }}>
        {data.length === 0 ? (
          <div className="no-data">
            <p>Waiting for incoming messages...</p>
          </div>
        ) : (
          <svg ref={svgRef}></svg>
        )}
      </div>
    </div>
  );
};

export default TrendTimeline;
