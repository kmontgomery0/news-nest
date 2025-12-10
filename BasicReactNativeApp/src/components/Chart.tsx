import React from 'react';
import {View, Text, StyleSheet, Dimensions, ScrollView} from 'react-native';
import {ChartData} from '../types';
import {text_primary_brown_color, accent_indigo_light_color} from '../styles/colors';

interface ChartProps {
  chartData: ChartData;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH * 0.75; // 75% of screen width
const CHART_HEIGHT = 200;
const PADDING = 20;

export const Chart: React.FC<ChartProps> = ({chartData}) => {
  const {type, title, x_axis_label, y_axis_label, data_points, description} = chartData;

  if (!data_points || data_points.length === 0) {
    return null;
  }

  // Dynamically expand width based on number of points to keep things readable.
  // Base assumption: ~6 points for line charts, ~5 bars for bar charts without scrolling.
  const baseVisibleCount = type === 'bar' ? 5 : 6;
  const rawScale = data_points.length / baseVisibleCount;
  // Clamp scale factor so charts don't get absurdly wide
  const scaleFactor = Math.min(Math.max(1, rawScale), 2.5);
  const contentWidth = CHART_WIDTH * scaleFactor;

  // Calculate chart dimensions
  const chartAreaWidth = contentWidth - PADDING * 2;
  const chartAreaHeight = CHART_HEIGHT - PADDING * 2;

  // Find min/max values for scaling
  const values = data_points.map(dp => dp.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1; // Avoid division by zero

  // Render based on chart type
  const renderChart = () => {
    let inner: JSX.Element;

    if (type === 'line' || type === 'area') {
      inner = renderLineChart();
    } else if (type === 'bar') {
      inner = renderBarChart();
    } else if (type === 'pie') {
      inner = renderPieChart();
    } else {
      // Default to line chart
      inner = renderLineChart();
    }
    // Always use a horizontal ScrollView so long charts can be explored.
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={contentWidth > CHART_WIDTH}
        contentContainerStyle={{paddingHorizontal: 0}}>
        {inner}
      </ScrollView>
    );
  };

  const renderLineChart = () => {
    const pointWidth = chartAreaWidth / (data_points.length - 1 || 1);
    const points = data_points.map((dp, index) => {
      const x = PADDING + index * pointWidth;
      const normalizedValue = (dp.value - minValue) / valueRange;
      const y = PADDING + chartAreaHeight - (normalizedValue * chartAreaHeight);
      return {x, y, label: dp.label, value: dp.value};
    });

    // Create path for line
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return (
      <View style={[styles.chartContainer, {width: contentWidth}]}>
        {/* Y-axis labels and title */}
        <View style={styles.yAxisContainer}>
          {y_axis_label && (
            <Text style={styles.yAxisTitle}>{y_axis_label}</Text>
          )}
          <Text style={styles.axisLabel}>{maxValue.toFixed(1)}</Text>
          <Text style={styles.axisLabel}>{((minValue + maxValue) / 2).toFixed(1)}</Text>
          <Text style={styles.axisLabel}>{minValue.toFixed(1)}</Text>
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Grid lines */}
          {[0, 0.5, 1].map(ratio => {
            const y = PADDING + chartAreaHeight - ratio * chartAreaHeight;
            return (
              <View
                key={ratio}
                style={[
                  styles.gridLine,
                  {top: y, left: PADDING, width: chartAreaWidth},
                ]}
              />
            );
          })}

          {/* Line (thin, connecting each point) */}
          <View style={styles.lineContainer}>
            {points.map((point, index) => {
              if (index === 0) {
                return null;
              }
              const prevPoint = points[index - 1];
              const dx = point.x - prevPoint.x;
              const dy = point.y - prevPoint.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx);
              const midX = (prevPoint.x + point.x) / 2;
              const midY = (prevPoint.y + point.y) / 2;
              return (
                <View
                  key={index}
                  style={[
                    styles.lineSegment,
                    {
                      width: length,
                      left: midX - length / 2,
                      top: midY - 1,
                      transform: [{rotate: `${angle}rad`}],
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Data points */}
          {points.map((point, index) => (
            <View
              key={index}
              style={[
                styles.dataPoint,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                },
              ]}
            />
          ))}

          {/* X-axis labels */}
          <View style={styles.xAxisContainer}>
            {points.map((point, index) => {
              // Show every nth label to avoid crowding
              const showLabel = index % Math.ceil(points.length / 5) === 0 || index === points.length - 1;
              if (!showLabel) return null;
              return (
                <Text
                  key={index}
                  style={[
                    styles.xAxisLabel,
                    {left: point.x - 20},
                  ]}
                  numberOfLines={1}>
                  {point.label.length > 8 ? point.label.substring(0, 8) + '...' : point.label}
                </Text>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderBarChart = () => {
    const barWidth = chartAreaWidth / data_points.length;
    const barSpacing = barWidth * 0.2;
    const actualBarWidth = barWidth - barSpacing;

    return (
      <View style={[styles.chartContainer, {width: contentWidth}]}>
        {/* Y-axis labels and title */}
        <View style={styles.yAxisContainer}>
          {y_axis_label && (
            <Text style={styles.yAxisTitle}>{y_axis_label}</Text>
          )}
          <Text style={styles.axisLabel}>{maxValue.toFixed(1)}</Text>
          <Text style={styles.axisLabel}>{((minValue + maxValue) / 2).toFixed(1)}</Text>
          <Text style={styles.axisLabel}>{minValue.toFixed(1)}</Text>
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Grid lines */}
          {[0, 0.5, 1].map(ratio => {
            const y = PADDING + chartAreaHeight - ratio * chartAreaHeight;
            return (
              <View
                key={ratio}
                style={[
                  styles.gridLine,
                  {top: y, left: PADDING, width: chartAreaWidth},
                ]}
              />
            );
          })}

          {/* Bars */}
          {data_points.map((dp, index) => {
            const normalizedValue = (dp.value - minValue) / valueRange;
            const barHeight = normalizedValue * chartAreaHeight;
            const x = PADDING + index * barWidth + barSpacing / 2;

            return (
              <View key={index} style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      left: x,
                      bottom: PADDING,
                      width: actualBarWidth,
                      height: barHeight,
                    },
                  ]}
                />
                {/* Value label above bar (only if not too many bars) */}
                {data_points.length <= 10 && (
                  <Text
                    style={[
                      styles.valueLabel,
                      {
                        left: x,
                        bottom: PADDING + barHeight + 4,
                        width: actualBarWidth + 8,
                      },
                    ]}
                    numberOfLines={1}>
                    {dp.value.toFixed(1)}
                  </Text>
                )}
                <Text
                  style={[
                    styles.barLabel,
                    {
                      left: x,
                      bottom: PADDING - 20,
                      width: actualBarWidth,
                    },
                  ]}
                  numberOfLines={1}>
                  {dp.label.length > 6 ? dp.label.substring(0, 6) + '...' : dp.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPieChart = () => {
    // Simple textual pie representation (legend style) to stay readable in small chat bubbles.
    // Each slice is represented by a colored bar and label with percentage.
    const total = values.reduce((sum, v) => sum + v, 0) || 1;
    return (
      <View style={[styles.chartContainer, {width: CHART_WIDTH}]}>
        <View style={styles.pieLegendContainer}>
          {data_points.map((dp, index) => {
            const ratio = (dp.value / total) * 100;
            return (
              <View key={index} style={styles.pieLegendRow}>
                <View
                  style={[
                    styles.pieColorSwatch,
                    {backgroundColor: accent_indigo_light_color, opacity: 0.6 + (index % 3) * 0.1},
                  ]}
                />
                <Text style={styles.pieLegendText} numberOfLines={1}>
                  {dp.label} — {ratio.toFixed(1)}%
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {renderChart()}
      {x_axis_label && (
        <Text style={styles.axisTitle}>{x_axis_label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: text_primary_brown_color,
    marginBottom: 4,
    fontFamily: 'Patrick Hand',
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontFamily: 'Patrick Hand',
  },
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  yAxisContainer: {
    width: 48,
    justifyContent: 'space-between',
    paddingRight: 8,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'Patrick Hand',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  lineContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  lineSegment: {
    position: 'absolute',
    backgroundColor: accent_indigo_light_color,
    height: 2,
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent_indigo_light_color,
    borderWidth: 2,
    borderColor: '#fff',
  },
  xAxisContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 20,
  },
  xAxisLabel: {
    position: 'absolute',
    fontSize: 9,
    color: '#666',
    fontFamily: 'Patrick Hand',
    width: 40,
    textAlign: 'center',
  },
  barContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  bar: {
    position: 'absolute',
    backgroundColor: accent_indigo_light_color,
    borderRadius: 2,
  },
  barLabel: {
    position: 'absolute',
    fontSize: 9,
    color: '#666',
    fontFamily: 'Patrick Hand',
    textAlign: 'center',
  },
  axisTitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Patrick Hand',
  },
  yAxisTitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Patrick Hand',
  },
  valueLabel: {
    position: 'absolute',
    fontSize: 9,
    color: '#444',
    fontFamily: 'Patrick Hand',
    textAlign: 'center',
  },
  pieLegendContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  pieColorSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  pieLegendText: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'Patrick Hand',
    flexShrink: 1,
  },
});

