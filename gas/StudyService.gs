function getQuestions(filters) {
  const spreadsheet = openStudySpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'question_bank');
  return readObjects_(sheet).filter(function (question) {
    if (filters.ata && String(question.ata) !== String(filters.ata)) {
      return false;
    }
    if (filters.status && String(question.check_status) !== String(filters.status)) {
      return false;
    }
    return true;
  });
}

function getQuestionDetail(questionId) {
  const spreadsheet = openStudySpreadsheet_();
  const question = readObjects_(getSheet_(spreadsheet, 'question_bank')).find(function (row) {
    return row.question_id === questionId;
  });
  if (!question) {
    throw new Error('Question not found: ' + questionId);
  }

  const candidates = readObjects_(getSheet_(spreadsheet, 'candidate_links'))
    .filter(function (row) { return row.question_id === questionId; })
    .sort(function (a, b) { return Number(a.rank) - Number(b.rank); });
  const notes = readObjects_(getSheet_(spreadsheet, 'answer_notes'))
    .filter(function (row) { return row.question_id === questionId; });
  const confirmed = readObjects_(getSheet_(spreadsheet, 'confirmed_answers'))
    .filter(function (row) { return row.question_id === questionId; });

  return {
    question: question,
    candidates: groupCandidates_(candidates),
    answerNotes: notes,
    confirmedAnswers: confirmed
  };
}

function saveAnswerNote(payload) {
  const spreadsheet = openStudySpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'answer_notes');
  const note = {
    note_id: generateId_('note'),
    question_id: payload.question_id,
    answer_text: payload.answer_text || '',
    evidence_page_codes: payload.evidence_page_codes || '',
    evidence_page_ids: payload.evidence_page_ids || '',
    evidence_excerpts: payload.evidence_excerpts || '',
    source_type: payload.source_type || 'manual_user',
    status: payload.status || 'draft',
    problem_reason: payload.problem_reason || '',
    created_at: nowIso_(),
    updated_at: nowIso_()
  };
  appendObject_(sheet, STUDY_SCHEMA.answer_notes, note);
  updateQuestionStatus(payload.question_id, CONFIG.STATUS.ANSWER_NOTE_READY);
  return note;
}

function saveConfirmedAnswer(payload) {
  const spreadsheet = openStudySpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'confirmed_answers');
  const answer = {
    answer_id: generateId_('ans'),
    question_id: payload.question_id,
    final_answer_text: payload.final_answer_text || payload.answer_text || '',
    evidence_page_codes: payload.evidence_page_codes || '',
    evidence_page_ids: payload.evidence_page_ids || '',
    evidence_excerpts: payload.evidence_excerpts || '',
    user_note: payload.user_note || '',
    confidence_by_user: payload.confidence_by_user || 'medium',
    created_at: nowIso_(),
    updated_at: nowIso_()
  };
  appendObject_(sheet, STUDY_SCHEMA.confirmed_answers, answer);
  updateQuestionStatus(payload.question_id, CONFIG.STATUS.CONFIRMED, answer.answer_id);
  return answer;
}

function holdQuestion(questionId) {
  updateQuestionStatus(questionId, CONFIG.STATUS.HOLD);
  return true;
}

function updateQuestionStatus(questionId, status, confirmedAnswerId) {
  const spreadsheet = openStudySpreadsheet_();
  const sheet = getSheet_(spreadsheet, 'question_bank');
  const patch = {
    check_status: status,
    updated_at: nowIso_()
  };
  if (confirmedAnswerId !== undefined) {
    patch.confirmed_answer_id = confirmedAnswerId;
  }
  return updateObjectById_(sheet, 'question_id', questionId, patch);
}

function groupCandidates_(candidates) {
  return candidates.reduce(function (groups, candidate) {
    const key = candidate.candidate_group || 'manual';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(candidate);
    return groups;
  }, {});
}
