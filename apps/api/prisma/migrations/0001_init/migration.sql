-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrackerLayout" AS ENUM ('TABLE', 'CHECKLIST', 'NOTES_BOARD', 'KANBAN');

-- CreateEnum
CREATE TYPE "DisplayDensity" AS ENUM ('COMPACT', 'COMFORTABLE', 'SPACIOUS');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BookmarkLabel" AS ENUM ('IMPORTANT', 'DIFFICULT', 'REVISE', 'CONTINUE_LATER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BookmarkTargetType" AS ENUM ('STUDY_ITEM', 'SYLLABUS_TOPIC', 'NOTE', 'MOCK_TEST');

-- CreateEnum
CREATE TYPE "FieldKey" AS ENUM ('NAME', 'DESCRIPTION', 'SUBJECT', 'TOPIC', 'SUBTOPIC', 'PRIORITY', 'STATUS', 'PLANNED_START', 'DUE_DATE', 'COMPLETED_AT', 'ESTIMATED_MINUTES', 'ACTUAL_MINUTES', 'ATTEMPTS', 'BOOKMARK', 'MOCK_TEST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'DELIVERED', 'SNOOZED', 'DISMISSED', 'MISSED');

-- CreateEnum
CREATE TYPE "ReminderRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'BROWSER');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "defaultTimeZone" TEXT NOT NULL DEFAULT 'UTC',
    "browserNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inAppNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "examDate" TIMESTAMP(3),
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PLANNING',
    "accentColor" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSchedulePreference" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "preferredStudyDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dailyTargetMinutes" INTEGER,
    "trackScheduleAdherence" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSchedulePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusNode" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "syllabusNodeId" TEXT,
    "trackerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "topic" TEXT,
    "subtopic" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "plannedStartDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCustomField" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyItemCustomValue" (
    "id" TEXT NOT NULL,
    "studyItemId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyItemCustomValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tracker" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" "TrackerLayout" NOT NULL DEFAULT 'TABLE',
    "accentColor" TEXT,
    "density" "DisplayDensity" NOT NULL DEFAULT 'COMFORTABLE',
    "viewConfig" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerColumn" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "fieldKey" "FieldKey" NOT NULL,
    "customFieldId" TEXT,
    "label" TEXT,
    "width" INTEGER,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerView" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "layout" "TrackerLayout",
    "density" "DisplayDensity",
    "filters" JSONB,
    "sorts" JSONB,
    "searchTerm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "studyItemId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "questionsAttempted" INTEGER,
    "questionsCorrect" INTEGER,
    "marksObtained" DOUBLE PRECISION,
    "maxMarks" DOUBLE PRECISION,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studyItemId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "manualMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "BookmarkTargetType" NOT NULL,
    "studyItemId" TEXT,
    "syllabusNodeId" TEXT,
    "noteId" TEXT,
    "mockTestId" TEXT,
    "label" "BookmarkLabel" NOT NULL DEFAULT 'IMPORTANT',
    "customLabel" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studyItemId" TEXT,
    "syllabusNodeId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockTest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "takenOn" TIMESTAMP(3) NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,
    "durationMinutes" INTEGER,
    "sections" JSONB,
    "notes" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studyItemId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "localDateTime" TIMESTAMP(3),
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "advanceMinutes" INTEGER,
    "recurrence" "ReminderRecurrence" NOT NULL DEFAULT 'NONE',
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "snoozedUntil" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "occurrenceKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Assessment_userId_status_idx" ON "Assessment"("userId", "status");

-- CreateIndex
CREATE INDEX "Assessment_userId_archivedAt_idx" ON "Assessment"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "Assessment_userId_examDate_idx" ON "Assessment"("userId", "examDate");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSchedulePreference_assessmentId_key" ON "AssessmentSchedulePreference"("assessmentId");

-- CreateIndex
CREATE INDEX "SyllabusNode_assessmentId_parentId_sortOrder_idx" ON "SyllabusNode"("assessmentId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "StudyItem_assessmentId_completed_idx" ON "StudyItem"("assessmentId", "completed");

-- CreateIndex
CREATE INDEX "StudyItem_assessmentId_dueDate_idx" ON "StudyItem"("assessmentId", "dueDate");

-- CreateIndex
CREATE INDEX "StudyItem_assessmentId_priority_idx" ON "StudyItem"("assessmentId", "priority");

-- CreateIndex
CREATE INDEX "StudyItem_trackerId_sortOrder_idx" ON "StudyItem"("trackerId", "sortOrder");

-- CreateIndex
CREATE INDEX "AssessmentCustomField_assessmentId_sortOrder_idx" ON "AssessmentCustomField"("assessmentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCustomField_assessmentId_key_key" ON "AssessmentCustomField"("assessmentId", "key");

-- CreateIndex
CREATE INDEX "StudyItemCustomValue_customFieldId_idx" ON "StudyItemCustomValue"("customFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyItemCustomValue_studyItemId_customFieldId_key" ON "StudyItemCustomValue"("studyItemId", "customFieldId");

-- CreateIndex
CREATE INDEX "Tracker_assessmentId_sortOrder_idx" ON "Tracker"("assessmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrackerColumn_trackerId_sortOrder_idx" ON "TrackerColumn"("trackerId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrackerView_trackerId_idx" ON "TrackerView"("trackerId");

-- CreateIndex
CREATE INDEX "PracticeAttempt_studyItemId_slotIndex_idx" ON "PracticeAttempt"("studyItemId", "slotIndex");

-- CreateIndex
CREATE INDEX "PracticeAttempt_attemptedAt_idx" ON "PracticeAttempt"("attemptedAt");

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "StudySession_assessmentId_startedAt_idx" ON "StudySession"("assessmentId", "startedAt");

-- CreateIndex
CREATE INDEX "StudySession_studyItemId_idx" ON "StudySession"("studyItemId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_targetType_idx" ON "Bookmark"("userId", "targetType");

-- CreateIndex
CREATE INDEX "Bookmark_userId_label_idx" ON "Bookmark"("userId", "label");

-- CreateIndex
CREATE INDEX "Bookmark_studyItemId_idx" ON "Bookmark"("studyItemId");

-- CreateIndex
CREATE INDEX "Note_userId_assessmentId_idx" ON "Note"("userId", "assessmentId");

-- CreateIndex
CREATE INDEX "Note_studyItemId_idx" ON "Note"("studyItemId");

-- CreateIndex
CREATE INDEX "MockTest_userId_assessmentId_takenOn_idx" ON "MockTest"("userId", "assessmentId", "takenOn");

-- CreateIndex
CREATE INDEX "Reminder_userId_status_remindAt_idx" ON "Reminder"("userId", "status", "remindAt");

-- CreateIndex
CREATE INDEX "Reminder_enabled_status_remindAt_idx" ON "Reminder"("enabled", "status", "remindAt");

-- CreateIndex
CREATE INDEX "Reminder_assessmentId_idx" ON "Reminder"("assessmentId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_status_idx" ON "NotificationDelivery"("userId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_scheduledFor_idx" ON "NotificationDelivery"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_reminderId_channel_occurrenceKey_key" ON "NotificationDelivery"("reminderId", "channel", "occurrenceKey");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSchedulePreference" ADD CONSTRAINT "AssessmentSchedulePreference_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusNode" ADD CONSTRAINT "SyllabusNode_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusNode" ADD CONSTRAINT "SyllabusNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SyllabusNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyItem" ADD CONSTRAINT "StudyItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyItem" ADD CONSTRAINT "StudyItem_syllabusNodeId_fkey" FOREIGN KEY ("syllabusNodeId") REFERENCES "SyllabusNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyItem" ADD CONSTRAINT "StudyItem_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCustomField" ADD CONSTRAINT "AssessmentCustomField_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyItemCustomValue" ADD CONSTRAINT "StudyItemCustomValue_studyItemId_fkey" FOREIGN KEY ("studyItemId") REFERENCES "StudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyItemCustomValue" ADD CONSTRAINT "StudyItemCustomValue_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "AssessmentCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tracker" ADD CONSTRAINT "Tracker_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerColumn" ADD CONSTRAINT "TrackerColumn_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerView" ADD CONSTRAINT "TrackerView_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_studyItemId_fkey" FOREIGN KEY ("studyItemId") REFERENCES "StudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_studyItemId_fkey" FOREIGN KEY ("studyItemId") REFERENCES "StudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_studyItemId_fkey" FOREIGN KEY ("studyItemId") REFERENCES "StudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_mockTestId_fkey" FOREIGN KEY ("mockTestId") REFERENCES "MockTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_syllabusNodeId_fkey" FOREIGN KEY ("syllabusNodeId") REFERENCES "SyllabusNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_studyItemId_fkey" FOREIGN KEY ("studyItemId") REFERENCES "StudyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_syllabusNodeId_fkey" FOREIGN KEY ("syllabusNodeId") REFERENCES "SyllabusNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockTest" ADD CONSTRAINT "MockTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockTest" ADD CONSTRAINT "MockTest_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_studyItemId_fkey" FOREIGN KEY ("studyItemId") REFERENCES "StudyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

