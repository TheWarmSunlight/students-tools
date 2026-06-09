"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { saveStoredClassroom, toStoredClassroom } from "@/components/teacherClassroom";

type ImportResponse = {
  questionSetId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isImportResponse(value: unknown): value is ImportResponse {
  return isRecord(value) && typeof value.questionSetId === "string";
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export default function QuestionEditor() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [expectedCount, setExpectedCount] = useState(30);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("请先选择 Excel 文件");
      return;
    }

    if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
      setError("预计人数必须大于 0");
      return;
    }

    setIsImporting(true);

    try {
      const form = new FormData();
      form.set("file", file);

      const trimmedTitle = title.trim();
      if (trimmedTitle) {
        form.set("title", trimmedTitle);
      }

      const importResponse = await fetch("/api/question-sets/import", {
        method: "POST",
        body: form,
      });
      const importBody = await readJson(importResponse);

      if (!importResponse.ok || !isImportResponse(importBody)) {
        throw new Error(readError(importBody, "题目导入失败"));
      }

      const classroomResponse = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionSetId: importBody.questionSetId,
          expectedCount,
        }),
      });
      const classroomBody = await readJson(classroomResponse);

      const classroom = toStoredClassroom(classroomBody);

      if (!classroomResponse.ok || !classroom) {
        throw new Error(readError(classroomBody, "课堂创建失败"));
      }

      saveStoredClassroom(classroom);
      router.push(`/teacher/classrooms/${classroom.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="teacherShell">
      <header className="teacherTopbar">
        <div>
          <p className="teacherEyebrow">教师端</p>
          <h1>课堂题目导入</h1>
        </div>
      </header>

      <section className="teacherContent">
        <form className="teacherPanel importPanel" onSubmit={handleSubmit}>
          <div className="formGrid">
            <label className="formField">
              <span>Excel 文件</span>
              <input
                data-testid="excel-file-input"
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>

            <label className="formField">
              <span>课堂标题</span>
              <input
                data-testid="classroom-title-input"
                type="text"
                value={title}
                placeholder="例如：五年级分数复习"
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
            </label>

            <label className="formField">
              <span>预计人数</span>
              <input
                data-testid="expected-count-input"
                type="number"
                min="1"
                value={expectedCount}
                onChange={(event) => setExpectedCount(Number(event.currentTarget.value))}
              />
            </label>
          </div>

          {error ? <p className="errorText">{error}</p> : null}

          <div className="actionRow">
            <button
              data-testid="import-button"
              className="primaryButton"
              type="submit"
              disabled={isImporting}
            >
              {isImporting ? "导入中" : "导入并创建课堂"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
