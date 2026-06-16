"use client";

import { useMemo } from "react";
import type { AmortizationPoint } from "@/lib/emi";
import { formatNpr } from "@/lib/emi";
import styles from "./emi.module.css";

interface EmiAmortizationChartProps {
  schedule: AmortizationPoint[];
  labels: {
    title: string;
    subtitle: string;
    principalPortion: string;
    interestPortion: string;
    periodAxis: string;
    outstandingBalance: string;
  };
  groupByYear: boolean;
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 36, left: 56 };

export function EmiAmortizationChart({
  schedule,
  labels,
  groupByYear,
}: EmiAmortizationChartProps) {
  const chart = useMemo(() => {
    if (schedule.length === 0) return null;

    const maxEmi = Math.max(...schedule.map((p) => p.emi), 1);
    const maxBalance = Math.max(...schedule.map((p) => p.balance), 1);
    const plotW = CHART_WIDTH - PAD.left - PAD.right;
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
    const barGap = 2;
    const barWidth = Math.max(4, (plotW - barGap * (schedule.length - 1)) / schedule.length);

    const bars = schedule.map((point, i) => {
      const x = PAD.left + i * (barWidth + barGap);
      const principalH = (point.principal / maxEmi) * plotH;
      const interestH = (point.interest / maxEmi) * plotH;
      const yBase = PAD.top + plotH;

      return {
        x,
        principalH,
        interestH,
        yPrincipal: yBase - principalH,
        yInterest: yBase - principalH - interestH,
        point,
        barWidth,
      };
    });

    const balanceLine = schedule
      .map((point, i) => {
        const cx = PAD.left + i * (barWidth + barGap) + barWidth / 2;
        const cy = PAD.top + plotH - (point.balance / maxBalance) * plotH * 0.85;
        return `${i === 0 ? "M" : "L"} ${cx} ${cy}`;
      })
      .join(" ");

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: PAD.top + plotH - t * plotH,
      value: maxEmi * t,
    }));

    const xLabelInterval =
      schedule.length <= 12 ? 1 : schedule.length <= 24 ? 2 : Math.ceil(schedule.length / 10);

    return { bars, balanceLine, yTicks, xLabelInterval };
  }, [schedule]);

  if (!chart) return null;

  return (
    <div className={styles.emiChartSection}>
      <div className={styles.emiChartHeader}>
        <h3 className={styles.emiChartTitle}>{labels.title}</h3>
        <p className={styles.emiChartSubtitle}>{labels.subtitle}</p>
      </div>

      <div className={styles.emiChartLegend}>
        <span>
          <i className={styles.legendDotPrincipal} />
          {labels.principalPortion}
        </span>
        <span>
          <i className={styles.legendDotInterest} />
          {labels.interestPortion}
        </span>
        <span className={styles.emiChartLegendBalance}>
          <svg width="20" height="10" aria-hidden>
            <line
              x1="0"
              y1="5"
              x2="20"
              y2="5"
              stroke="#0f6e56"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          {labels.outstandingBalance}
        </span>
      </div>

      <div className={styles.emiChartWrap}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className={styles.emiChartSvg}
          role="img"
          aria-label={labels.title}
        >
          {chart.yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={PAD.left}
                y1={tick.y}
                x2={CHART_WIDTH - PAD.right}
                y2={tick.y}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                className={styles.emiChartAxisText}
              >
                {tick.value >= 1000 ? `${Math.round(tick.value / 1000)}k` : Math.round(tick.value)}
              </text>
            </g>
          ))}

          {chart.bars.map((bar, i) => (
            <g key={i}>
              <rect
                x={bar.x}
                y={bar.yPrincipal}
                width={bar.barWidth}
                height={bar.principalH}
                className={styles.emiChartBarPrincipal}
                rx="1"
              >
                <title>
                  {labels.periodAxis} {bar.point.label}: {labels.principalPortion}{" "}
                  {formatNpr(bar.point.principal)}
                </title>
              </rect>
              <rect
                x={bar.x}
                y={bar.yInterest}
                width={bar.barWidth}
                height={bar.interestH}
                className={styles.emiChartBarInterest}
                rx="1"
              >
                <title>
                  {labels.periodAxis} {bar.point.label}: {labels.interestPortion}{" "}
                  {formatNpr(bar.point.interest)}
                </title>
              </rect>
              {(i % chart.xLabelInterval === 0 || i === chart.bars.length - 1) && (
                <text
                  x={bar.x + bar.barWidth / 2}
                  y={CHART_HEIGHT - 10}
                  textAnchor="middle"
                  className={styles.emiChartAxisText}
                >
                  {groupByYear ? `Y${bar.point.label}` : bar.point.label}
                </text>
              )}
            </g>
          ))}

          <path
            d={chart.balanceLine}
            fill="none"
            stroke="#0f6e56"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <text x={PAD.left} y={CHART_HEIGHT - 2} className={styles.emiChartAxisLabel}>
            {labels.periodAxis}
          </text>
        </svg>
      </div>
    </div>
  );
}
