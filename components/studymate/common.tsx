"use client";
import { BookOpen, ChevronRight, FileAudio, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import type { Lecture, Subject } from "@/lib/studymate/types";
import { formatDuration } from "@/lib/studymate/types";

export function Brand() { return <span className="brand"><span className="brand-mark"><BookOpen size={21} strokeWidth={2.2} /></span><span>Study<span className="brand-end">Mate</span></span></span>; }
export function Picker({ value, onChange, options, label, disabled = false }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string; disabled?: boolean }) {
 return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="picker"><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
export function Blank({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
 return <Empty className="empty-box"><EmptyHeader><EmptyMedia variant="icon"><FolderOpen /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{action && <EmptyContent><Button variant="outline" onClick={onAction}>{action}</Button></EmptyContent>}</Empty>;
}
export function LectureRow({ lecture, subject, onClick }: { lecture: Lecture; subject?: Subject; onClick: () => void }) {
 return <button className="lecture-row" onClick={onClick}><span className={"subject-icon " + (subject?.color ?? "blue")}><FileAudio size={21} /></span><span className="lecture-row-text"><strong>{lecture.title}</strong><span>{subject?.name ?? "Unfiled"}<span className="text-separator">·</span>{new Date(lecture.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span><span className="lecture-row-meta"><span className="tag">{lecture.mode === "sample" ? "Sample" : lecture.notes ? "Study notes" : "Recording"}</span><span>{formatDuration(lecture.duration)}</span></span><ChevronRight size={18} /></button>;
}
export function Download({ text, name, children }: { text: string; name: string; children: React.ReactNode }) {
 return <Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>{children}</Button>;
}
