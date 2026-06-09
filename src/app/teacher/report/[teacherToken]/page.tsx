import AnalysisReport from "@/components/AnalysisReport";

type ReportPageProps = {
  params: Promise<{ teacherToken: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { teacherToken } = await params;

  return <AnalysisReport teacherToken={teacherToken} />;
}

