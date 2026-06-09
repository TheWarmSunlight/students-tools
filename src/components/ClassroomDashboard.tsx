"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QrPanel from "@/components/QrPanel";
import {
  isClassroomStatusUpdate,
  loadStoredClassroom,
  saveStoredClassroom,
  type StoredClassroom,
} from "@/components/teacherClassroom";
import type { ClassroomAnalytics } from "@/lib/stats/analytics";

type ClassroomDashboardProps = {
  classroomId: string;
  initialClassroom?: StoredClassroom;
  initialStats?: ClassroomAnalytics;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export default function ClassroomDashboard({
  classroomId,
  initialClassroom,
  initialStats,
}: ClassroomDashboardProps) {
  const [classroom, setClassroom] = useState<StoredClassroom | null>(initialClassroom ?? null);
  const [stats, setStats] = useState<ClassroomAnalytics | null>(initialStats ?? null);
  const [hasLoaded, setHasLoaded] = useState(Boolean(initialClassroom));
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (initialClassroom) {
      return;
    }

    setClassroom(loadStoredClassroom(classroomId));
    setHasLoaded(true);
  }, [classroomId, initialClassroom]);

  const refreshStats = useCallback(async (teacherToken: string) => {
    const response = await fetch(`/api/teacher/${teacherToken}/stats`, { cache: "no-store" });
    const body = await readJson(response);

    if (!response.ok) {
      setError("学情数据读取失败");
      return;
    }

    setStats(body as ClassroomAnalytics);
    setError("");
  }, []);

  useEffect(() => {
    if (!classroom) {
      return;
    }

    void refreshStats(classroom.teacherToken);
    const timer = window.setInterval(() => {
      void refreshStats(classroom.teacherToken);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [classroom, refreshStats]);

  async function updateStatus(action: "start" | "end") {
    if (!classroom) {
      return;
    }

    setIsUpdating(true);
    setError("");

    try {
      const response = await fetch(`/api/classrooms/${classroom.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherToken: classroom.teacherToken }),
      });
      const body = await readJson(response);

      if (!response.ok || !isClassroomStatusUpdate(body)) {
        setError(action === "start" ? "课堂开始失败" : "课堂结束失败");
        return;
      }

      const nextClassroom = { ...classroom, ...body };
      setClassroom(nextClassroom);
      saveStoredClassroom(nextClassroom);
      await refreshStats(classroom.teacherToken);
    } finally {
      setIsUpdating(false);
    }
  }

  if (!hasLoaded) {
    return (
      <main className="teacherShell">
        <header className="teacherTopbar">
          <h1>课堂控制台</h1>
        </header>
        <section className="teacherContent">
          <p className="mutedText">正在读取课堂记录...</p>
        </section>
      </main>
    );
  }

  if (!classroom) {
    return (
      <main className="teacherShell">
        <header className="teacherTopbar">
          <h1>课堂控制台</h1>
        </header>
        <section className="teacherContent">
          <div className="emptyState">
            <h2>未找到课堂记录</h2>
            <p>请从本浏览器重新导入题目并创建课堂。</p>
            <Link className="primaryLink" href="/teacher">
              返回导入页
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const submittedCount = stats?.submittedStudentCount ?? 0;

  return (
    <main className="teacherShell">
      <header className="teacherTopbar">
        <div>
          <p className="teacherEyebrow">课堂控制台</p>
          <h1>课堂实时学情</h1>
        </div>
        <div className="topbarActions">
          <Link className="lightLink" href={`/teacher/classrooms/${classroom.id}/projector`}>
            投屏二维码
          </Link>
          <Link
            data-testid="teacher-report-link"
            className="lightLink"
            href={`/teacher/report/${classroom.teacherToken}`}
          >
            学情报告
          </Link>
        </div>
      </header>

      <section className="teacherContent dashboardGrid">
        <section className="teacherPanel statusPanel">
          <div className="sectionTitleRow">
            <div>
              <h2>课堂状态</h2>
              <p className="mutedText">当前状态：{classroom.status}</p>
            </div>
            <span className={`statusBadge ${classroom.status}`}>{classroom.status}</span>
          </div>

          <div className="metricGrid">
            <div className="metricTile">
              <span>已提交</span>
              <strong data-testid="submitted-count">{submittedCount}</strong>
            </div>
            <div className="metricTile">
              <span>预计人数</span>
              <strong>{stats?.expectedCount ?? classroom.expectedCount}</strong>
            </div>
            <div className="metricTile">
              <span>提交率</span>
              <strong>{formatPercent(stats?.submitRate ?? 0)}</strong>
            </div>
            <div className="metricTile">
              <span>平均正确率</span>
              <strong>{formatPercent(stats?.averageAccuracy ?? 0)}</strong>
            </div>
          </div>

          <div className="actionRow">
            <button
              data-testid="start-classroom-button"
              className="primaryButton"
              type="button"
              disabled={isUpdating || classroom.status === "active"}
              onClick={() => void updateStatus("start")}
            >
              开始课堂
            </button>
            <button
              className="dangerButton"
              type="button"
              disabled={isUpdating || classroom.status === "ended"}
              onClick={() => void updateStatus("end")}
            >
              结束课堂
            </button>
          </div>

          {error ? <p className="errorText">{error}</p> : null}
        </section>

        <QrPanel classroom={classroom} />
      </section>
    </main>
  );
}

