import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import { GeoMetrics } from '../../types';

const GeoHeatMap: React.FC = () => {
  const [data, setData] = useState<GeoMetrics | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/metrics/geo`);
        setData(response.data);
      } catch (error) {
        console.error('Error fetching geo metrics:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 500;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Prepare data
    const cities = Object.keys(data);
    const sentiments = cities.map(city => data[city].avg_sentiment);

    // Scales
    const xScale = d3.scaleBand()
      .domain(cities)
      .range([0, chartWidth])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([chartHeight, 0]);

    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(['#ef4444', '#fbbf24', '#10b981']);

    // Axes
    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px');

    // Bars
    g.selectAll('.bar')
      .data(cities)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d)!)
      .attr('width', xScale.bandwidth())
      .attr('y', chartHeight)
      .attr('height', 0)
      .attr('fill', d => colorScale(data[d].avg_sentiment))
      .attr('rx', 4)
      .transition()
      .duration(1000)
      .attr('y', d => data[d].avg_sentiment >= 0 ? yScale(data[d].avg_sentiment) : yScale(0))
      .attr('height', d => Math.abs(yScale(data[d].avg_sentiment) - yScale(0)));

    // Values on top
    g.selectAll('.value')
      .data(cities)
      .enter()
      .append('text')
      .attr('class', 'value')
      .attr('x', d => xScale(d)! + xScale.bandwidth() / 2)
      .attr('y', d => yScale(data[d].avg_sentiment) - 5)
      .attr('text-anchor', 'middle')
      .style('fill', '#e7e9ea')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => data[d].avg_sentiment.toFixed(2));

  }, [data]);

  if (!data) {
    return (
      <div>
        <div className="panel-header">
          <h2 className="panel-title">Geographic Sentiment</h2>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Geographic Sentiment</h2>
      </div>
      <div className="panel-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default GeoHeatMap;
