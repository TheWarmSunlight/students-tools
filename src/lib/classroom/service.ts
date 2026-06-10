import QRCode from "qrcode";
import type { CreatedClassroom, RepositorySet } from "@/lib/db/repositories";

type Repositories = RepositorySet;

export type ClassroomQuestionLink = {
  questionId: string;
  questionNo: string;
  studentUrl: string;
  qrDataUrl: string;
};

export type CreatedClassroomWithLinks = CreatedClassroom & {
  teacherUrl: string;
  questions: ClassroomQuestionLink[];
};

function normalizeBaseUrl(appBaseUrl: string) {
  return appBaseUrl.replace(/\/+$/, "");
}

export function createClassroomService(
  repos: Repositories,
  appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000",
) {
  const baseUrl = normalizeBaseUrl(appBaseUrl);

  return {
    async createClassroom(
      questionSetId: string,
      expectedCount: number,
    ): Promise<CreatedClassroomWithLinks> {
      const classroom = await repos.classrooms.create(questionSetId, expectedCount);
      const questions = await repos.questionSets.listQuestions(questionSetId);
      const questionLinks = await Promise.all(
        questions.map(async (question) => {
          const token = await repos.questionTokens.create(classroom.id, question.id);
          const studentUrl = `${baseUrl}/student/${token}`;
          const qrDataUrl = await QRCode.toDataURL(studentUrl);

          return {
            questionId: question.id,
            questionNo: question.questionNo,
            studentUrl,
            qrDataUrl,
          };
        }),
      );

      return {
        ...classroom,
        teacherUrl: `${baseUrl}/teacher/report/${classroom.teacherToken}`,
        questions: questionLinks,
      };
    },

    startClassroom(classroomId: string) {
      return repos.classrooms.setStatus(classroomId, "active");
    },

    endClassroom(classroomId: string) {
      return repos.classrooms.setStatus(classroomId, "ended");
    },

    resolveQuestionToken(token: string) {
      return repos.questionTokens.get(token);
    },
  };
}
