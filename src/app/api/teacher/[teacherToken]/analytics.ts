import type { ClassroomRecord, RepositorySet } from "@/lib/db/repositories";
import { buildClassroomAnalytics } from "@/lib/stats/analytics";

export async function buildTeacherAnalytics(repos: RepositorySet, classroom: ClassroomRecord) {
  const [questions, students, submissions] = await Promise.all([
    repos.questionSets.listQuestions(classroom.questionSetId),
    repos.students.listByClassroom(classroom.id),
    repos.submissions.listByClassroom(classroom.id),
  ]);

  return buildClassroomAnalytics({
    expectedCount: classroom.expectedCount,
    questions,
    students: students.map((student) => ({
      id: student.id,
      seatNo: student.seatNo,
      name: student.name,
    })),
    submissions: submissions.map((submission) => ({
      questionId: submission.questionId,
      studentId: submission.studentId,
      gradedItems: submission.gradedItems,
      allCorrect: submission.allCorrect,
    })),
  });
}
