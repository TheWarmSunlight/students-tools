import { ClassroomProjector } from "@/components/QrPanel";

type ProjectorPageProps = {
  params: Promise<{ classroomId: string }>;
};

export default async function ProjectorPage({ params }: ProjectorPageProps) {
  const { classroomId } = await params;

  return <ClassroomProjector classroomId={classroomId} />;
}

