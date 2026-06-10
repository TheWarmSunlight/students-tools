"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  ClassroomAnalytics,
  KnowledgePointAnalytics,
  QuestionAnalytics,
} from "@/lib/stats/analytics";
import { requestAiReport, requestTeacherStats } from "@/components/teacherRequests";

type AnalysisReportProps = {
  teacherToken: string;
  initialStats?: ClassroomAnalytics;
};

type AiStatus = "idle" | "loading" | "generated" | "skipped" | "failed";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function barWidth(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

function knowledgePointClass(point: KnowledgePointAnalytics) {
  if (point.accuracy >= 0.8) {
    return "barFill green";
  }
  if (point.accuracy >= 0.6) {
    return "barFill blue";
  }
  if (point.accuracy >= 0.4) {
    return "barFill orange";
  }
  return "barFill red";
}

function questionRows(questions: QuestionAnalytics[]) {
  return questions.map((question) => (
    <tr key={question.questionId}>
      <td>{question.questionNo}</td>
      <td>{formatPercent(question.itemAccuracy)}</td>
      <td>{formatPercent(question.allCorrectRate)}</td>
      <td>{question.submittedCount}</td>
    </tr>
  ));
}

export default function AnalysisReport({ teacherToken, initialStats }: AnalysisReportProps) {
  const [stats, setStats] = useState<ClassroomAnalytics | null>(initialStats ?? null);
  const [isLoading, setIsLoading] = useState(!initialStats);
  const [error, setError] = useState("");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    if (initialStats) {
      return;
    }

    let cancelled = false;

    async function loadStats() {
      setIsLoading(true);
      try {
        const result = await requestTeacherStats({
          teacherToken,
          errorMessage: "报告数据读取失败",
        });

        if (cancelled) {
          return;
        }

        if (result.status === "error") {
          setError(result.error);
          return;
        }

        setStats(result.stats);
        setError("");
      } catch {
        if (!cancelled) {
          setError("报告数据读取失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [initialStats, teacherToken]);

  async function generateAiReport() {
    setAiStatus("loading");
    setError("");

    try {
      const result = await requestAiReport({ teacherToken });

      if (result.status === "error") {
        setAiStatus("failed");
        return;
      }

      setStats(result.report.summary);
      setAiText(result.report.aiText);
      setAiStatus(result.report.aiStatus);
    } catch {
      setAiStatus("failed");
    }
  }

  if (isLoading) {
    return (
      <main className="teacherShell">
        <header className="teacherTopbar">
          <h1>学情报告</h1>
        </header>
        <section className="teacherContent">
          <p className="mutedText">正在读取报告...</p>
        </section>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="teacherShell">
        <header className="teacherTopbar">
          <h1>学情报告</h1>
        </header>
        <section className="teacherContent">
          <div className="emptyState">
            <h2>无法打开报告</h2>
            <p>{error || "教师口令无效或课堂不存在。"}</p>
            <Link className="primaryLink" href="/teacher">
              返回导入页
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="teacherShell reportShell">
      <header className="teacherTopbar">
        <div>
          <p className="teacherEyebrow">教师报告</p>
          <h1>学情报告</h1>
        </div>
      </header>

      <section className="teacherContent reportGrid">
        <section className="teacherPanel">
          <h2>学生层级分布</h2>
          <div className="layerList">
            {stats.layers.map((layer) => (
              <div className="layerRow" key={layer.code}>
                <div>
                  <strong>{layer.name}</strong>
                  <span>{layer.count} 人</span>
                </div>
                <div className="barTrack">
                  <span className={`barFill layer${layer.code}`} style={{ width: barWidth(layer.percentage) }} />
                </div>
                <span>{formatPercent(layer.percentage)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="teacherPanel">
          <h2>知识点掌握</h2>
          <div className="knowledgeList">
            {stats.knowledgePoints.map((point) => (
              <div
                data-testid={`knowledge-point-${point.name}`}
                className="knowledgeRow"
                key={point.name}
              >
                <div className="rowLabel">
                  <strong>{point.name}</strong>
                  <span>
                    {point.correctItems}/{point.totalItems}
                  </span>
                </div>
                <div className="barTrack">
                  <span className={knowledgePointClass(point)} style={{ width: barWidth(point.accuracy) }} />
                </div>
                <span>{formatPercent(point.accuracy)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="teacherPanel widePanel">
          <h2>题目正确率</h2>
          <div className="tableWrap">
            <table className="reportTable">
              <thead>
                <tr>
                  <th>题号</th>
                  <th>小题正确率</th>
                  <th>全对率</th>
                  <th>提交人数</th>
                </tr>
              </thead>
              <tbody>{questionRows(stats.questions)}</tbody>
            </table>
          </div>
        </section>

        <section className="teacherPanel widePanel">
          <div className="sectionTitleRow">
            <h2>AI 诊断</h2>
            <button
              data-testid="generate-ai-report-button"
              className="primaryButton"
              type="button"
              disabled={aiStatus === "loading"}
              onClick={() => void generateAiReport()}
            >
              {aiStatus === "loading" ? "生成中" : "生成 AI 报告"}
            </button>
          </div>

          {aiStatus === "generated" && aiText ? (
            <p className="aiReportText">{aiText}</p>
          ) : null}
          {aiStatus === "skipped" ? (
            <p className="noticeText">未配置 AI 服务，暂时无法生成 AI 诊断。</p>
          ) : null}
          {aiStatus === "failed" ? (
            <p className="errorText">AI 报告生成失败，请稍后重试。</p>
          ) : null}
          {aiStatus === "idle" ? <p className="mutedText">等待生成</p> : null}
        </section>
      </section>
    </main>
  );
}
