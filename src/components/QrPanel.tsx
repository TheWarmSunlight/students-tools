"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  loadStoredClassroom,
  type ClassroomQuestionLink,
  type StoredClassroom,
} from "@/components/teacherClassroom";

type QrPanelProps = {
  classroom: StoredClassroom;
  projector?: boolean;
};

type ClassroomProjectorProps = {
  classroomId: string;
};

export default function QrPanel({ classroom, projector = false }: QrPanelProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    classroom.questions[0]?.questionId ?? "",
  );
  const selectedQuestion = useMemo<ClassroomQuestionLink | undefined>(
    () =>
      classroom.questions.find((question) => question.questionId === selectedQuestionId) ??
      classroom.questions[0],
    [classroom.questions, selectedQuestionId],
  );

  if (!selectedQuestion) {
    return (
      <section className="teacherPanel">
        <h2>课堂题目</h2>
        <p className="mutedText">当前课堂没有可展示的题目。</p>
      </section>
    );
  }

  return (
    <section className={projector ? "projectorSurface" : "teacherPanel qrPanel"}>
      <div className="sectionTitleRow">
        <div>
          <h2>{projector ? "投屏二维码" : "课堂二维码"}</h2>
          <p className="mutedText">当前题目：{selectedQuestion.questionNo}</p>
        </div>
      </div>

      <div className="qrLayout">
        <div className="questionList" aria-label="Question list">
          {classroom.questions.map((question) => (
            <button
              className={
                question.questionId === selectedQuestion.questionId
                  ? "questionSelector active"
                  : "questionSelector"
              }
              type="button"
              key={question.questionId}
              onClick={() => setSelectedQuestionId(question.questionId)}
            >
              {question.questionNo}
            </button>
          ))}
        </div>

        <div className="qrDisplay">
          <Image
            data-testid="current-question-qr"
            className="qrImage"
            src={selectedQuestion.qrDataUrl}
            width={520}
            height={520}
            unoptimized
            alt={`${selectedQuestion.questionNo} 学生答题二维码`}
          />
          <a
            data-testid={`student-link-${selectedQuestion.questionNo}`}
            className="studentUrl"
            href={selectedQuestion.studentUrl}
            target="_blank"
            rel="noreferrer"
          >
            {selectedQuestion.studentUrl}
          </a>
        </div>
      </div>
    </section>
  );
}

export function ClassroomProjector({ classroomId }: ClassroomProjectorProps) {
  const [classroom, setClassroom] = useState<StoredClassroom | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setClassroom(loadStoredClassroom(classroomId));
    setHasLoaded(true);
  }, [classroomId]);

  if (!hasLoaded) {
    return (
      <main className="teacherShell">
        <header className="teacherTopbar">
          <h1>课堂投屏</h1>
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
          <h1>课堂投屏</h1>
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

  return (
    <main className="teacherShell projectorShell">
      <header className="teacherTopbar">
        <div>
          <p className="teacherEyebrow">课堂投屏</p>
          <h1>学生扫码答题</h1>
        </div>
        <Link className="lightLink" href={`/teacher/classrooms/${classroom.id}`}>
          返回课堂
        </Link>
      </header>
      <section className="teacherContent">
        <QrPanel classroom={classroom} projector />
      </section>
    </main>
  );
}
