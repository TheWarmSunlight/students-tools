import type { createRepositories, ClassroomRecord } from "@/lib/db/repositories";
import { buildClassroomAnalytics } from "@/lib/stats/analytics";

type Repositories = ReturnType<typeof createRepositories>;

export function buildTeacherAnalytics(repos: Repositories, classroom: ClassroomRecord) {
  return buildClassroomAnalytics({
    expectedCount: classroom.expectedCount,
    questions: repos.questionSets.listQuestions(classroom.questionSetId),
    students: repos.students.listByClassroom(classroom.id).map((student) => ({
      id: student.id,
      seatNo: student.seatNo,
      name: student.name,
    })),
    submissions: repos.submissions.listByClassroom(classroom.id).map((submission) => ({
      questionId: submission.questionId,
      studentId: submission.studentId,
      gradedItems: submission.gradedItems,
      allCorrect: submission.allCorrect,
    })),
  });
}
