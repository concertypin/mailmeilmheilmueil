import { useState } from "react";
import { DEFAULT_ANALYSIS_FIELDS } from "@/lib/mail-schema";
import { useAnalysisCriteria } from "@/lib/analysis-criteria-data";

interface CustomFieldForm {
    key: string;
    label: string;
    instruction: string;
}

const emptyForm: CustomFieldForm = { key: "", label: "", instruction: "" };

function isDuplicateKey(key: string, customFields: { key: string }[]): boolean {
    const defaultKeys = new Set(DEFAULT_ANALYSIS_FIELDS.map((f) => f.key));
    return defaultKeys.has(key) || customFields.some((f) => f.key === key);
}

export default function Settings() {
    const {
        criteria,
        isLoading,
        loadError,
        saveCriteria,
        saveError,
        isSaving,
    } = useAnalysisCriteria();

    const [disabledDefaultKeys, setDisabledDefaultKeys] = useState<string[]>(
        () => criteria.disabledDefaultKeys ?? []
    );
    const [localCustomFields, setLocalCustomFields] = useState<
        CustomFieldForm[]
    >(() =>
        criteria.customFields.map((f) => ({
            key: f.key,
            label: f.label,
            instruction: f.instruction,
        }))
    );
    const [newField, setNewField] = useState<CustomFieldForm>(emptyForm);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    function handleAdd() {
        setFieldError(null);

        const trimmedKey = newField.key.trim();
        const trimmedLabel = newField.label.trim();
        const trimmedInstruction = newField.instruction.trim();

        if (!trimmedKey || !trimmedLabel || !trimmedInstruction) {
            setFieldError("모든 필드를 입력해 주세요.");
            return;
        }

        if (!/^[a-z][A-Za-z0-9]{0,31}$/.test(trimmedKey)) {
            setFieldError(
                "키는 소문자로 시작하고 영문과 숫자만 사용할 수 있습니다."
            );
            return;
        }

        if (isDuplicateKey(trimmedKey, localCustomFields)) {
            setFieldError(
                "이미 존재하는 키입니다. 기본 키와 중복되거나 다른 사용자 필드와 중복될 수 없습니다."
            );
            return;
        }

        if (trimmedLabel.length > 50) {
            setFieldError("레이블은 50자를 초과할 수 없습니다.");
            return;
        }

        if (trimmedInstruction.length > 500) {
            setFieldError("설명은 500자를 초과할 수 없습니다.");
            return;
        }

        setLocalCustomFields([
            ...localCustomFields,
            {
                key: trimmedKey,
                label: trimmedLabel,
                instruction: trimmedInstruction,
            },
        ]);
        setNewField(emptyForm);
    }

    function handleRemove(index: number) {
        setLocalCustomFields(localCustomFields.filter((_, i) => i !== index));
    }

    async function handleSave() {
        setFieldError(null);
        setSaveMessage(null);

        if (localCustomFields.length > 13) {
            setFieldError(
                "사용자 정의 필드는 최대 13개까지 추가할 수 있습니다."
            );
            return;
        }

        try {
            await saveCriteria({
                disabledDefaultKeys,
                customFields: localCustomFields.map((f) => ({
                    ...f,
                    isCategory: false,
                })),
            });
            setSaveMessage(
                "저장되었습니다. 다음 동기화부터 새 기준이 적용됩니다."
            );
        } catch {
            setSaveMessage(null);
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center">
                <span className="loading loading-spinner loading-lg" />
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100dvh-4.5rem)] space-y-6 px-6 py-8 sm:px-8 lg:px-10">
            <div>
                <h1 className="text-3xl font-bold">AI 분석 기준 설정</h1>
                <p className="mt-2 text-base-content/60">
                    AI가 메일을 분석할 때 추출할 필드를 관리합니다.
                </p>
            </div>

            {loadError ? (
                <div role="alert" className="alert alert-error">
                    <span>{loadError}</span>
                </div>
            ) : null}

            {/* ── Default schema with toggles ──────────────── */}
            <section className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body">
                    <h2 className="card-title">기본 스키마</h2>
                    <p className="text-sm text-base-content/60">
                        각 필드를 켜거나 꺼서 분석에 포함할 기본 필드를
                        선택하세요.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>사용</th>
                                    <th>키</th>
                                    <th>레이블</th>
                                    <th>설명</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DEFAULT_ANALYSIS_FIELDS.map((field) => {
                                    const isEnabled =
                                        !disabledDefaultKeys.includes(
                                            field.key
                                        );
                                    return (
                                        <tr key={field.key}>
                                            <td>
                                                <input
                                                    aria-label={`${field.label} 사용`}
                                                    className="toggle toggle-primary toggle-sm"
                                                    type="checkbox"
                                                    checked={isEnabled}
                                                    onChange={() => {
                                                        setDisabledDefaultKeys(
                                                            (prev) =>
                                                                isEnabled
                                                                    ? [
                                                                          ...prev,
                                                                          field.key,
                                                                      ]
                                                                    : prev.filter(
                                                                          (k) =>
                                                                              k !==
                                                                              field.key
                                                                      )
                                                        );
                                                    }}
                                                />
                                            </td>
                                            <td className="font-mono text-sm">
                                                {field.key}
                                            </td>
                                            <td
                                                className={
                                                    isEnabled
                                                        ? ""
                                                        : "text-base-content/40"
                                                }
                                            >
                                                {field.label}
                                            </td>
                                            <td className="text-sm text-base-content/70">
                                                {field.instruction}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ── Custom fields ───────────────────────────── */}
            <section className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body">
                    <h2 className="card-title">사용자 정의 필드</h2>
                    <p className="text-sm text-base-content/60">
                        원하는 분석 필드를 추가하세요.
                    </p>

                    {localCustomFields.length === 0 ? (
                        <p className="text-sm text-base-content/40">
                            아직 추가된 사용자 정의 필드가 없습니다.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>키</th>
                                        <th>레이블</th>
                                        <th>설명</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {localCustomFields.map((field, index) => (
                                        <tr key={index}>
                                            <td className="font-mono text-sm">
                                                {field.key}
                                            </td>
                                            <td>{field.label}</td>
                                            <td className="text-sm text-base-content/70">
                                                {field.instruction}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-outline btn-error btn-sm"
                                                    onClick={() =>
                                                        handleRemove(index)
                                                    }
                                                    type="button"
                                                >
                                                    삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="divider" />

                    <h3 className="font-semibold">새 필드 추가</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <label className="fieldset">
                            <span className="label">키 (Key)</span>
                            <input
                                aria-label="키"
                                className="input w-full"
                                placeholder="예: participationFee"
                                type="text"
                                value={newField.key}
                                onChange={(e) =>
                                    setNewField({
                                        ...newField,
                                        key: e.currentTarget.value,
                                    })
                                }
                            />
                        </label>
                        <label className="fieldset">
                            <span className="label">레이블 (Label)</span>
                            <input
                                aria-label="레이블"
                                className="input w-full"
                                placeholder="예: 참가비"
                                type="text"
                                value={newField.label}
                                onChange={(e) =>
                                    setNewField({
                                        ...newField,
                                        label: e.currentTarget.value,
                                    })
                                }
                            />
                        </label>
                        <label className="fieldset md:col-span-2">
                            <span className="label">
                                추출 지시 (Instruction)
                            </span>
                            <input
                                aria-label="추출 지시"
                                className="input w-full"
                                placeholder="예: 무료 여부와 금액을 추출"
                                type="text"
                                value={newField.instruction}
                                onChange={(e) =>
                                    setNewField({
                                        ...newField,
                                        instruction: e.currentTarget.value,
                                    })
                                }
                            />
                        </label>
                    </div>

                    {fieldError ? (
                        <div role="alert" className="alert alert-error mt-2">
                            <span>{fieldError}</span>
                        </div>
                    ) : null}

                    <div className="mt-2">
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={handleAdd}
                            type="button"
                        >
                            추가
                        </button>
                    </div>

                    <div className="divider" />

                    <div className="flex items-center gap-4">
                        <button
                            className="btn btn-primary"
                            disabled={isSaving}
                            onClick={() => {
                                void handleSave();
                            }}
                            type="button"
                        >
                            {isSaving ? (
                                <span className="loading loading-spinner loading-xs" />
                            ) : null}
                            저장
                        </button>
                        {saveMessage ? (
                            <span className="text-sm text-success">
                                {saveMessage}
                            </span>
                        ) : null}
                        {saveError ? (
                            <span role="alert" className="text-sm text-error">
                                {saveError}
                            </span>
                        ) : null}
                    </div>
                </div>
            </section>
        </div>
    );
}
