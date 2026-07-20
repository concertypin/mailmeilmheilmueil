import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: "127.0.0.1",
    port: Number(process.env.SMTP_PORT ?? 2525),
    secure: false,
});

await transporter.sendMail({
    from: "미래직업교육원 <notice@example.invalid>",
    to: "promotion@example.invalid",
    subject: "2026 여름 데이터 분석 직무교육 참가자 모집",
    text: `미래직업교육원에서 대학생을 대상으로 데이터 분석 직무교육
참가자를 모집합니다.

모집 대상: 데이터 분석 직무에 관심 있는 대학생
교육 기간: 2026년 8월 10일~8월 14일
신청 마감: 2026년 7월 31일
주요 혜택: 교육비 전액 지원, 수료증 발급
신청 방법: 예시 신청 페이지에서 온라인 신청
`,
});

console.log("Sample mail sent to 127.0.0.1");
