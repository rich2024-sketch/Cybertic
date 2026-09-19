"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronRight, FolderOpen, GraduationCap, Headphones, House, LogOut, Mic, Plus, UserRound } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Lecture, Store, Student, Subject } from "@/lib/studymate/types";
import { initials, newId, yearLabel } from "@/lib/studymate/types";
import type { ProfileSetup } from "@/lib/studymate/workspace";
import { loadWorkspace, persistWorkspace, saveProfile, type ViewerIdentity } from "@/lib/studymate/workspace-client";
import { Brand, Blank, LectureRow, Picker } from "./common";
import { Recording } from "./recording";
import { LectureDetail } from "./session";

type Route = { page: "home" | "subjects" | "profile" | "record" | "subject" | "lecture"; id?: string };

const SUBJECT_COLORS = ["blue", "teal", "orange", "purple"] as const;

function routeFromHash(): Route {
  if (typeof window === "undefined") return { page: "home" };
  const [page, id] = location.hash.replace(/^#\/?/, "").split("/");
  return { page: ["home", "subjects", "profile", "subject", "lecture"].includes(page) ? page as Route["page"] : "home", id };
}

export default function StudyMate() {
  const [store, setStore] = useState<Store | null>(null);
  const [identity, setIdentity] = useState<ViewerIdentity | null>(null);
  const [problem, setProblem] = useState("");
  const [route, setRoute] = useState<Route>({ page: "home" });
  const [aiReady, setAiReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const storeRef = useRef<Store | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: { name: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: "get_study_workspace",
        description: "Read the authenticated student's visible subjects and saved lecture metadata. Does not change data or start recording.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
            throw new Error("Use an empty input object.");
          }
          const data = storeRef.current;
          const current = data?.students.find(student => student.id === data.activeStudentId);
          if (!data || !current) return { loggedIn: false };
          return {
            loggedIn: true,
            student: { name: current.name, major: current.major, year: current.year },
            subjects: current.subjects,
            lectures: data.lectures
              .filter(lecture => lecture.studentId === current.id)
              .map(({ id, title, subjectId, createdAt, mode }) => ({ id, title, subjectId, createdAt, mode })),
          };
        },
      }, { signal: controller.signal })).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setMounted(true);
    setRoute(routeFromHash());
    const hash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", hash);

    let cancelled = false;
    Promise.all([
      loadWorkspace(),
      fetch("/api/status", { cache: "no-store", signal: AbortSignal.timeout(7000) })
        .then(response => response.ok ? response.json() : null)
        .catch(() => null),
    ]).then(([workspace, status]) => {
      if (cancelled || !alive.current) return;
      setIdentity(workspace.identity);
      storeRef.current = workspace.store;
      setStore(workspace.store);
      setProblem("");
      setAiReady(!!status && typeof status === "object" && "enabled" in status && status.enabled === true);
      setLoaded(true);
    }).catch(error => {
      if (cancelled || !alive.current) return;
      setProblem(error instanceof Error ? error.message : "StudyMate could not open your protected workspace.");
      setLoaded(true);
    });

    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", hash);
    };
  }, []);

  function queueSave(next: Store) {
    setSyncing(true);
    saveQueue.current = saveQueue.current
      .then(() => persistWorkspace(next))
      .then(saved => {
        if (!alive.current) return;
        storeRef.current = saved;
        setStore(saved);
      })
      .catch(error => {
        if (!alive.current) return;
        toast.error(error instanceof Error ? error.message : "StudyMate could not sync the workspace.");
      })
      .finally(() => {
        if (alive.current) setSyncing(false);
      });
  }

  function update(fn: (old: Store) => Store) {
    if (!storeRef.current) return false;
    try {
      const next = fn(storeRef.current);
      storeRef.current = next;
      setStore(next);
      queueSave(next);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "StudyMate could not save your changes.");
      return false;
    }
  }

  function go(page: Route["page"], id?: string) {
    if (page === "record") {
      setRoute({ page, id });
      return;
    }
    location.hash = page + (id ? "/" + id : "");
    setRoute({ page, id });
  }

  if (problem) {
    return <main className="boot"><Brand /><h1>We couldn’t open your workspace</h1><p>{problem}</p><Button onClick={() => location.reload()}>Try again</Button></main>;
  }

  if (!loaded) {
    return <main className="boot"><Brand /><p>Opening your protected StudyMate workspace…</p></main>;
  }

  const student = store?.students.find(item => item.id === store.activeStudentId) ?? null;

  if (!student) {
    return <><ProfileSetup identity={identity} onCreate={async profile => {
      const next = await saveProfile(profile);
      storeRef.current = next;
      setStore(next);
      go("home");
      toast.success("Your StudyMate profile is ready.");
    }} />{mounted && <Toaster position="top-center" richColors />}</>;
  }

  const lectures = store!.lectures.filter(lecture => lecture.studentId === student.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function saveLecture(lecture: Lecture) {
    return update(current => ({
      ...current,
      lectures: [...current.lectures.filter(item => item.id !== lecture.id), lecture],
    }));
  }

  if (route.page === "record") {
    return <><Recording
      student={student}
      initialSubjectId={route.id}
      aiReady={aiReady}
      onCancel={() => go("home")}
      onSave={lecture => {
        if (saveLecture(lecture)) {
          go("lecture", lecture.id);
          toast.success(lecture.hasAudio ? "Lecture saved. Its audio stays on this device." : "Lecture saved to your protected workspace.");
          return true;
        }
        return false;
      }}
    />{mounted && <Toaster position="top-center" richColors />}</>;
  }

  const subject = student.subjects.find(item => item.id === route.id);
  const lecture = lectures.find(item => item.id === route.id);
  const title = route.page === "home"
    ? "Overview"
    : route.page === "subjects"
      ? "My subjects"
      : route.page === "profile"
        ? "My profile"
        : route.page === "subject"
          ? subject?.name ?? "Subject"
          : "Lecture notes";

  return <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
    <AppSidebar student={student} route={route} go={go} onLogout={() => { location.href = "/cdn-cgi/access/logout"; }} />
    <SidebarInset className="main-surface">
      <header className="topbar">
        <div className="topbar-left"><SidebarTrigger className="mobile-menu" /><span className="topbar-section">Your workspace</span><ChevronRight size={15} /><span>{title}</span></div>
        <div className="topbar-right">
          <span className="tag demo-tag">{syncing ? "Syncing…" : identity?.source === "dev-mock" ? "Local preview" : "Cloudflare Access"}</span>
          <span className="avatar small">{initials(student.name)}</span>
        </div>
      </header>
      <main className="page-content" id="main-content">
        {route.page === "home" && <>
          <div className="page-heading"><div><p className="eyebrow">LET’S MAKE TODAY CLEARER</p><h1>Your study space, {student.name.split(" ")[0]}.</h1><p>Every lecture. In your language. In the right place.</p></div><span className="semester">{student.school}<br /><strong>{student.major} · {yearLabel(student.year)}</strong></span></div>
          <div className="overview-grid"><section className="record-card"><span className="record-card-icon"><Mic size={27} /></span><div><span className="record-card-caption">KOREAN → ENGLISH</span><h2>A new class starts here.</h2><p>Capture the lecture. Keep the understanding.</p></div><Button className="record-cta" onClick={() => go("record")}><Mic size={18} />Start Recording<ChevronRight size={17} /></Button></section><section className="study-stats"><div><span className="stat-symbol blue"><FolderOpen size={21} /></span><strong>{student.subjects.length}</strong><span>Subjects this semester</span></div><div><span className="stat-symbol teal"><Headphones size={21} /></span><strong>{lectures.length}</strong><span>Saved lectures</span></div></section></div>
          <div className="section-heading"><h2>My subjects <span>{student.subjects.length}</span></h2><Button variant="ghost" onClick={() => go("subjects")}>View all<ChevronRight size={16} /></Button></div>
          <SubjectGrid student={student} lectures={lectures} go={go} />
          <div className="section-heading"><h2>Recent lectures</h2><span className="muted">Your latest class sessions</span></div>
          <div className="lecture-list">{lectures.length ? lectures.slice(0, 5).map(item => <LectureRow key={item.id} lecture={item} subject={student.subjects.find(subjectItem => subjectItem.id === item.subjectId)} onClick={() => go("lecture", item.id)} />) : <Blank title="Your first lecture belongs here" description="Record a class, or try a sample to explore translations, notes, and quizzes." action="Try a sample lecture" onAction={() => go("record")} />}</div>
          <p className="local-note">Lecture text, notes, and subject edits sync to your protected workspace. Audio recordings stay on this device unless you download them.</p>
        </>}
        {route.page === "subjects" && <>
          <div className="page-heading"><div><p className="eyebrow">ONE PLACE FOR EVERY CLASS</p><h1>My subjects</h1><p>Open a subject to find all its lecture sessions.</p></div><Button variant="outline" onClick={() => go("profile")}><Plus size={17} />Manage subjects</Button></div>
          <SubjectGrid student={student} lectures={lectures} go={go} />
          {lectures.some(item => !item.subjectId) && <><div className="section-heading"><h2>Unfiled lectures</h2></div><div className="lecture-list">{lectures.filter(item => !item.subjectId).map(item => <LectureRow key={item.id} lecture={item} onClick={() => go("lecture", item.id)} />)}</div></>}
        </>}
        {route.page === "subject" && (subject
          ? <><Button variant="ghost" className="back-link" onClick={() => go("subjects")}>← All subjects</Button><div className="page-heading"><div><p className="eyebrow">{subject.code}</p><h1>{subject.name}</h1><p>{lectures.filter(item => item.subjectId === subject.id).length} saved lecture sessions</p></div><Button onClick={() => go("record", subject.id)}><Mic size={17} />Record this class</Button></div><div className="lecture-list">{lectures.filter(item => item.subjectId === subject.id).length ? lectures.filter(item => item.subjectId === subject.id).map(item => <LectureRow key={item.id} lecture={item} subject={subject} onClick={() => go("lecture", item.id)} />) : <Blank title="A fresh page for this subject" description="Recordings, translations, notes, and quizzes for each class session will appear here." action="Start Recording" onAction={() => go("record", subject.id)} />}</div></>
          : <Blank title="Subject not found" description="Choose one of the subjects in your profile." action="My subjects" onAction={() => go("subjects")} />)}
        {route.page === "lecture" && (lecture
          ? <LectureDetail key={lecture.id} lecture={lecture} student={student} aiReady={aiReady} onChange={saveLecture} onBack={() => go(lecture.subjectId ? "subject" : "subjects", lecture.subjectId ?? undefined)} />
          : <Blank title="Lecture not found" description="This session is not available in your workspace." action="Go home" onAction={() => go("home")} />)}
        {route.page === "profile" && <Profile student={student} lectures={lectures} identity={identity} onSave={nextStudent => {
          const allowedSubjectIds = new Set(nextStudent.subjects.map(subjectItem => subjectItem.id));
          const ok = update(current => ({
            ...current,
            students: current.students.map(item => item.id === nextStudent.id ? nextStudent : item),
            lectures: current.lectures.map(item => item.studentId === nextStudent.id
              ? { ...item, subjectId: item.subjectId && allowedSubjectIds.has(item.subjectId) ? item.subjectId : null }
              : item),
          }));
          if (ok) toast.success("Profile saved.");
          return ok;
        }} />}
      </main>
    </SidebarInset>
    {mounted && <Toaster position="top-center" richColors />}
  </SidebarProvider>;
}

function ProfileSetup({ identity, onCreate }: { identity: ViewerIdentity | null; onCreate: (profile: ProfileSetup) => Promise<void> }) {
  const [draft, setDraft] = useState<ProfileSetup>({
    name: identity?.name && identity.name !== identity.email ? identity.name : "",
    major: "",
    year: 1,
    school: "",
    subjects: [],
  });
  const [busy, setBusy] = useState(false);

  function addSubject() {
    setDraft(current => ({
      ...current,
      subjects: [...current.subjects, { id: newId(), name: "", code: "", color: SUBJECT_COLORS[current.subjects.length % SUBJECT_COLORS.length] }],
    }));
  }

  return <main className="login-page"><section className="login-story"><Brand /><div className="login-story-copy"><span className="tag light-tag">YOUR CLASS. YOUR UNDERSTANDING.</span><h1>Welcome to<br />your workspace.</h1><p>Cloudflare Access has already verified who you are. Set up your student profile once, then keep every lecture together.</p><div className="language-line"><span>Cloudflare Access</span><span className="language-dash" /><Headphones size={24} /><span className="language-dash" /><span>StudyMate</span></div></div><p className="login-foot">Audio stays on your device. Profile, subjects, transcripts, and notes sync to the backend.</p></section><section className="login-content"><div className="login-box"><div className="mobile-brand"><Brand /></div><span className="eyebrow">FIRST LOGIN SETUP</span><h2>Create your student profile</h2><p>This profile is linked to your verified Cloudflare Access session.</p><div className="demo-disclosure"><GraduationCap size={20} /><p><strong>Verified email</strong>{identity?.email ?? "Protected session"}</p></div><form className="profile-form" onSubmit={async event => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.major.trim() || !draft.school.trim() || draft.subjects.some(subject => !subject.name.trim())) {
      toast.error("Fill in your name, school, major, and any subject names you add.");
      return;
    }
    setBusy(true);
    try {
      await onCreate({
        ...draft,
        name: draft.name.trim(),
        major: draft.major.trim(),
        school: draft.school.trim(),
        subjects: draft.subjects.map(subject => ({ ...subject, name: subject.name.trim(), code: subject.code.trim() })),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile setup could not be saved.");
    } finally {
      setBusy(false);
    }
  }}>
    <section className="panel"><div className="panel-title"><UserRound size={22} /><h2>Student details</h2></div><div className="field-grid"><label>Name<Input value={draft.name} maxLength={80} required onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>School<Input value={draft.school} maxLength={120} required onChange={event => setDraft({ ...draft, school: event.target.value })} /></label><label>Major<Input value={draft.major} maxLength={100} required onChange={event => setDraft({ ...draft, major: event.target.value })} /></label><label>Academic year<Picker label="Academic year" value={String(draft.year)} onChange={value => setDraft({ ...draft, year: Number(value) })} options={[1, 2, 3, 4, 5, 6].map(year => ({ value: String(year), label: yearLabel(year) }))} /></label></div><p className="field-help">You can add or edit subjects now or later. Year only adjusts explanation depth; it is not a measure of ability.</p></section>
    <section className="panel"><div className="section-heading compact"><h2>Enrolled subjects</h2><Button type="button" variant="outline" disabled={draft.subjects.length >= 20} onClick={addSubject}><Plus size={17} />Add subject</Button></div>{draft.subjects.length ? draft.subjects.map(subject => <div className="subject-edit" key={subject.id}><span className={"subject-line " + subject.color} /><label className="grow">Subject name<Input value={subject.name} maxLength={100} onChange={event => setDraft({ ...draft, subjects: draft.subjects.map(item => item.id === subject.id ? { ...item, name: event.target.value } : item) })} /></label><label className="code-field">Code<Input value={subject.code} maxLength={40} onChange={event => setDraft({ ...draft, subjects: draft.subjects.map(item => item.id === subject.id ? { ...item, code: event.target.value } : item) })} /></label><Button type="button" variant="ghost" onClick={() => setDraft({ ...draft, subjects: draft.subjects.filter(item => item.id !== subject.id) })}>Remove</Button></div>) : <p className="muted">No subjects yet. You can create the profile now and add classes afterwards.</p>}</section>
    <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create workspace"}</Button>
  </form></div></section></main>;
}

function AppSidebar({ student, route, go, onLogout }: { student: Student; route: Route; go: (page: Route["page"], id?: string) => void; onLogout: () => void }) {
  const { setOpenMobile } = useSidebar();
  function nav(page: Route["page"], id?: string) { setOpenMobile(false); go(page, id); }
  return <Sidebar><SidebarHeader className="sidebar-brand"><Brand /></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>WORKSPACE</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{[{ page: "home" as const, name: "Overview", icon: House }, { page: "subjects" as const, name: "My subjects", icon: FolderOpen }, { page: "profile" as const, name: "My profile", icon: UserRound }].map(item => <SidebarMenuItem key={item.page}><SidebarMenuButton isActive={route.page === item.page} onClick={() => nav(item.page)} className="nav-button"><item.icon size={19} /><span>{item.name}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup><SidebarGroup><SidebarGroupLabel>THIS SEMESTER</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{student.subjects.map(subject => <SidebarMenuItem key={subject.id}><SidebarMenuButton isActive={route.page === "subject" && route.id === subject.id} onClick={() => nav("subject", subject.id)} className="nav-button subject-nav"><span className={"subject-line " + subject.color} /><span>{subject.name}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="sidebar-footer"><div className="sidebar-note"><BookOpen size={19} /><p><strong>A little review goes a long way.</strong>Revisit your class notes while they’re still fresh.</p></div><div className="account-footer"><span className="avatar small">{initials(student.name)}</span><span><strong>{student.name}</strong><small>{yearLabel(student.year)} · {student.major}</small></span><Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" onClick={onLogout}><LogOut size={17} /></Button></div></SidebarFooter></Sidebar>;
}

function SubjectGrid({ student, lectures, go }: { student: Student; lectures: Lecture[]; go: (page: Route["page"], id?: string) => void }) {
  return <div className="subject-grid">{student.subjects.map(subject => <button className={"subject-card border-" + subject.color} key={subject.id} onClick={() => go("subject", subject.id)}><div className="subject-card-top"><span className={"subject-icon " + subject.color}><BookOpen size={23} /></span><span className="muted">{subject.code}</span></div><h3>{subject.name}</h3><div className="subject-card-bottom"><span>{lectures.filter(lecture => lecture.subjectId === subject.id).length} lectures</span><ChevronRight size={18} /></div></button>)}{!student.subjects.length && <Blank title="Add your subjects" description="Your study space works with any major. Add your current classes to get started." action="Edit profile" onAction={() => go("profile")} />}</div>;
}

function Profile({ student, lectures, identity, onSave }: { student: Student; lectures: Lecture[]; identity: ViewerIdentity | null; onSave: (student: Student) => boolean }) {
  const [draft, setDraft] = useState(() => structuredClone(student));
  const [removeId, setRemoveId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(structuredClone(student));
  }, [student]);

  function updateSubject(subjectId: string, change: Partial<Subject>) {
    setDraft(current => ({
      ...current,
      subjects: current.subjects.map(subject => subject.id === subjectId ? { ...subject, ...change } : subject),
    }));
  }

  return <><div className="page-heading"><div><p className="eyebrow">A LITTLE CONTEXT HELPS</p><h1>My profile</h1><p>Your academic year guides the depth of new study notes.</p></div><span className="tag demo-tag">{identity?.email ?? "Protected student"}</span></div><form className="profile-form" onSubmit={event => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.major.trim() || !draft.school.trim() || draft.subjects.some(subject => !subject.name.trim())) {
      toast.error("Fill in your name, school, major, and subject names.");
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      major: draft.major.trim(),
      school: draft.school.trim(),
      subjects: draft.subjects.map(subject => ({ ...subject, name: subject.name.trim(), code: subject.code.trim() })),
    });
  }}><section className="panel"><div className="panel-title"><UserRound size={22} /><h2>Student details</h2></div><div className="field-grid"><label>Name<Input value={draft.name} maxLength={80} required onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>Major<Input value={draft.major} maxLength={100} required onChange={event => setDraft({ ...draft, major: event.target.value })} /></label><label>Academic year<Picker label="Academic year" value={String(draft.year)} onChange={value => setDraft({ ...draft, year: Number(value) })} options={[1, 2, 3, 4, 5, 6].map(year => ({ value: String(year), label: yearLabel(year) }))} /></label><label>School<Input value={draft.school} maxLength={120} required onChange={event => setDraft({ ...draft, school: event.target.value })} /><span className="field-help">This profile is tied to your verified Cloudflare Access session.</span></label></div><p className="field-help">Year is a starting point for explanation depth, not a measure of ability. Audio files remain on the device that recorded them.</p></section><section className="panel"><div className="section-heading compact"><h2>Enrolled subjects</h2><Button type="button" variant="outline" disabled={draft.subjects.length >= 20} onClick={() => setDraft({ ...draft, subjects: [...draft.subjects, { id: newId(), name: "", code: "", color: SUBJECT_COLORS[draft.subjects.length % SUBJECT_COLORS.length] }] })}><Plus size={17} />Add subject</Button></div>{draft.subjects.map(subject => <div className="subject-edit" key={subject.id}><span className={"subject-line " + subject.color} /><label className="grow">Subject name<Input value={subject.name} maxLength={100} required onChange={event => updateSubject(subject.id, { name: event.target.value })} /></label><label className="code-field">Code<Input value={subject.code} maxLength={40} onChange={event => updateSubject(subject.id, { code: event.target.value })} /></label><Button type="button" variant="ghost" disabled={draft.subjects.length === 1 && lectures.some(lecture => lecture.subjectId === subject.id)} onClick={() => setRemoveId(subject.id)}>Remove</Button></div>)}{!draft.subjects.length && <p className="muted">Add the classes you are taking now, then StudyMate can file lectures under the right subject.</p>}</section><Button type="submit">Save profile</Button></form><AlertDialog open={!!removeId} onOpenChange={open => !open && setRemoveId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this subject?</AlertDialogTitle><AlertDialogDescription>{lectures.some(lecture => lecture.subjectId === removeId) ? "Saved lectures in this subject will move to Unfiled if you confirm." : "This only removes the subject from your profile."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => { if (!removeId) return; setDraft(current => ({ ...current, subjects: current.subjects.filter(subject => subject.id !== removeId) })); setRemoveId(null); }}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
