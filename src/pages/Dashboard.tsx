import { Link } from "wouter";
import { useMailData } from "@/lib/mail-data";

export default function Dashboard() {
    const { items, isLoading, loadError } = useMailData();

    const totalCount = items?.length ?? 0;
    const processedCount = items
        ? items.filter((i) => i.processedAt !== null).length
        : 0;
    const reviewCount = items
        ? items.filter((i) => i.status === "ready" && i.analysis !== null)
              .length
        : 0;
    const pendingCount = items
        ? items.filter(
              (i) => i.status === "queued" || i.status === "processing"
          ).length
        : 0;
    const failedCount = items
        ? items.filter((i) => i.status === "failed").length
        : 0;

    return (
        <div className="min-h-[calc(100vh-4.5rem)] bg-base-200 p-6 sm:p-10">
            <div className="mx-auto max-w-3xl">
                <h1 className="text-2xl font-bold">대시보드</h1>
                <p className="mt-2 text-base-content/60">
                    메일 분석 현황을 한눈에 확인하세요.
                </p>

                {loadError && items === null ? (
                    <>
                        <div role="alert" className="alert alert-error mt-6">
                            <span>
                                메일 통계를 불러오지 못했습니다: {loadError}
                            </span>
                        </div>
                        <div className="mt-6 flex justify-center">
                            <Link className="btn btn-outline" href="/inbox">
                                전체 메일함 열기
                            </Link>
                        </div>
                    </>
                ) : loadError ? (
                    <div role="alert" className="alert alert-error mt-6">
                        <span>
                            메일 통계를 불러오지 못했습니다: {loadError}
                        </span>
                    </div>
                ) : null}

                {isLoading && items === null ? (
                    <div role="alert" className="alert alert-info mt-6">
                        <span>메일 통계를 불러오는 중...</span>
                    </div>
                ) : null}

                {items === null ? null : items.length === 0 ? (
                    <div className="mt-8">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <StatCard label="전체 메일" count={0} />
                            <StatCard label="처리 완료" count={0} />
                            <StatCard label="리뷰 필요" count={0} />
                            <StatCard label="분석 대기" count={0} />
                            <StatCard label="분석 실패" count={0} />
                        </div>
                        <p className="mt-8 text-center text-base-content/50">
                            표시할 메일이 없습니다. 메일함 동기화 후 다시
                            확인하세요.
                        </p>
                        <div className="mt-6 flex justify-center">
                            <Link className="btn btn-outline" href="/inbox">
                                전체 메일함 열기
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="mt-8">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <StatCard label="전체 메일" count={totalCount} />
                            <StatCard
                                label="처리 완료"
                                count={processedCount}
                            />
                            <StatCard label="리뷰 필요" count={reviewCount} />
                            <StatCard label="분석 대기" count={pendingCount} />
                            <StatCard label="분석 실패" count={failedCount} />
                        </div>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                            <Link
                                className="btn btn-primary"
                                href="/inbox?folder=review"
                            >
                                리뷰 필요 메일 확인
                            </Link>
                            <Link className="btn btn-outline" href="/inbox">
                                전체 메일함 열기
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, count }: { label: string; count: number }) {
    return (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body items-center text-center">
                <p className="text-base-content/60 text-sm font-medium">
                    {label}
                </p>
                <p
                    className="text-3xl font-bold"
                    aria-label={`${label}: ${count}개`}
                >
                    {count}
                </p>
            </div>
        </div>
    );
}
