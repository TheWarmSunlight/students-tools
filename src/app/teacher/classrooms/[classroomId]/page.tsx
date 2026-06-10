import ClassroomDashboard from "@/components/ClassroomDashboard";

type ClassroomPageProps = {
  params: Promise<{ classroomId: string }>;
};

export default async function ClassroomPage({ params }: ClassroomPageProps) {
  const { classroomId } = await params;

  return <ClassroomDashboard classroomId={classroomId} />;
}
