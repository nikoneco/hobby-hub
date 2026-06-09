const MASTER_SCHEMA = {
  hub_modules: [
    'module_id',
    'module_name',
    'description',
    'enabled',
    'display_order',
    'icon',
    'route',
    'db_spreadsheet_id',
    'created_at',
    'updated_at'
  ],
  hub_settings: ['key', 'value', 'note', 'updated_at']
};

const STUDY_SCHEMA = {
  source_files: [
    'source_id',
    'source_type',
    'ata',
    'file_name',
    'drive_file_id',
    'local_path',
    'version',
    'note',
    'imported_at'
  ],
  textbook_pages: [
    'page_id',
    'ata',
    'source_id',
    'pdf_name',
    'pdf_page',
    'page_code',
    'page_type',
    'section_code',
    'section_title',
    'title',
    'body_text',
    'normalized_text',
    'keywords',
    'related_page_code',
    'related_page_id',
    'drive_url',
    'created_at',
    'updated_at'
  ],
  textbook_sections: [
    'section_id',
    'ata',
    'section_name',
    'start_page_code',
    'end_page_code',
    'source_id',
    'display_order',
    'keywords'
  ],
  question_bank: [
    'question_id',
    'ata',
    'source_id',
    'pdf_page',
    'section_name',
    'subsection_name',
    'question_text',
    'normalized_question',
    'question_type',
    'expected_answer_style',
    'check_status',
    'confirmed_answer_id',
    'created_at',
    'updated_at'
  ],
  candidate_links: [
    'candidate_id',
    'question_id',
    'page_id',
    'ata',
    'candidate_group',
    'page_code',
    'pdf_page',
    'title',
    'section_title',
    'excerpt',
    'score',
    'match_terms',
    'rank',
    'generated_by',
    'generated_at',
    'user_status'
  ],
  answer_notes: [
    'note_id',
    'question_id',
    'answer_text',
    'evidence_page_codes',
    'evidence_page_ids',
    'evidence_excerpts',
    'source_type',
    'status',
    'problem_reason',
    'created_at',
    'updated_at'
  ],
  confirmed_answers: [
    'answer_id',
    'question_id',
    'final_answer_text',
    'evidence_page_codes',
    'evidence_page_ids',
    'evidence_excerpts',
    'user_note',
    'confidence_by_user',
    'created_at',
    'updated_at'
  ],
  review_queue: [
    'review_id',
    'question_id',
    'ata',
    'section_name',
    'question_text',
    'current_answer_text',
    'candidate_page_codes',
    'candidate_excerpts',
    'problem_reason',
    'priority',
    'assigned_to',
    'status',
    'created_at',
    'updated_at'
  ],
  term_dictionary: ['term', 'full_name', 'japanese', 'aliases', 'ata', 'note'],
  search_log: [
    'log_id',
    'action',
    'question_id',
    'query',
    'result_count',
    'selected_candidate_id',
    'status',
    'message',
    'created_at'
  ]
};

function getSetupStatus() {
  return {
    hobbyHubMasterId: getScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_MASTER_ID) || '',
    study737DbId: getScriptProperty_(CONFIG.PROPERTIES.STUDY737_DB_ID) || '',
    hobbyHubFolderId: CONFIG.DRIVE.HOBBY_HUB_FOLDER_ID,
    study737FolderId: CONFIG.DRIVE.STUDY737_FOLDER_ID
  };
}

function setupProject_() {
  setScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_FOLDER_ID, CONFIG.DRIVE.HOBBY_HUB_FOLDER_ID);
  setScriptProperty_(CONFIG.PROPERTIES.STUDY737_FOLDER_ID, CONFIG.DRIVE.STUDY737_FOLDER_ID);

  const master = ensureSpreadsheetInFolder_(
    CONFIG.DRIVE.HOBBY_HUB_FOLDER_ID,
    CONFIG.SPREADSHEETS.HOBBY_HUB_MASTER_TITLE
  );
  const study = ensureSpreadsheetInFolder_(
    CONFIG.DRIVE.STUDY737_FOLDER_ID,
    CONFIG.SPREADSHEETS.STUDY737_DB_TITLE
  );

  setScriptProperty_(CONFIG.PROPERTIES.HOBBY_HUB_MASTER_ID, master.getId());
  setScriptProperty_(CONFIG.PROPERTIES.STUDY737_DB_ID, study.getId());

  Object.keys(MASTER_SCHEMA).forEach(function (sheetName) {
    ensureSheet_(master, sheetName, MASTER_SCHEMA[sheetName]);
  });
  Object.keys(STUDY_SCHEMA).forEach(function (sheetName) {
    ensureSheet_(study, sheetName, STUDY_SCHEMA[sheetName]);
  });

  seedMaster_(master, study.getId());
  seedStudySamples_(study);

  return {
    hobbyHubMaster: {
      id: master.getId(),
      url: master.getUrl()
    },
    study737Db: {
      id: study.getId(),
      url: study.getUrl()
    }
  };
}

function ensureSpreadsheetInFolder_(folderId, title) {
  const folder = DriveApp.getFolderById(folderId);
  const existing = folder.getFilesByName(title);
  while (existing.hasNext()) {
    const file = existing.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(file.getId());
    }
  }

  const spreadsheet = SpreadsheetApp.create(title);
  const file = DriveApp.getFileById(spreadsheet.getId());
  file.moveTo(folder);
  return spreadsheet;
}

function seedMaster_(spreadsheet, studyDbId) {
  const sheet = getSheet_(spreadsheet, 'hub_modules');
  const rows = readObjects_(sheet);
  if (rows.some(function (row) { return row.module_id === 'study737'; })) {
    updateObjectById_(sheet, 'module_id', 'study737', {
      db_spreadsheet_id: studyDbId,
      updated_at: nowIso_()
    });
    return;
  }
  appendObject_(sheet, MASTER_SCHEMA.hub_modules, {
    module_id: 'study737',
    module_name: '737 Study Finder',
    description: '737-800 Study Guideと標準問題集の検索・回答補助',
    enabled: true,
    display_order: 1,
    icon: 'book-open',
    route: 'study737',
    db_spreadsheet_id: studyDbId,
    created_at: nowIso_(),
    updated_at: nowIso_()
  });
}

function seedStudySamples_(spreadsheet) {
  const questionSheet = getSheet_(spreadsheet, 'question_bank');
  const pageSheet = getSheet_(spreadsheet, 'textbook_pages');
  const candidateSheet = getSheet_(spreadsheet, 'candidate_links');
  const sourceSheet = getSheet_(spreadsheet, 'source_files');
  const termSheet = getSheet_(spreadsheet, 'term_dictionary');
  const sourceRows = readObjects_(sourceSheet);

  if (!sourceRows.some(function (row) { return row.source_id === 'src_sg_24_ref'; })) {
    appendObject_(sourceSheet, STUDY_SCHEMA.source_files, {
      source_id: 'src_sg_24_ref',
      source_type: 'study_guide_pdf',
      ata: '24',
      file_name: '24_REF.pdf',
      drive_file_id: '',
      local_path: '../737_Study_Finder/Study_Guide/24_REF.pdf',
      version: 'sample',
      note: 'Initial local source. Import pipeline will replace samples later.',
      imported_at: nowIso_()
    });
  }

  if (!readObjects_(questionSheet).some(function (row) { return row.question_id === 'q_24_sample_standby_light'; })) {
    appendObject_(questionSheet, STUDY_SCHEMA.question_bank, {
      question_id: 'q_24_sample_standby_light',
      ata: '24',
      source_id: 'src_question_bank',
      pdf_page: 4,
      section_name: 'Electrical Power',
      subsection_name: 'Generator Drive and Standby Power Module',
      question_text: 'Generator Drive and Standby Power Module の3つのLightを説明しなさい。',
      normalized_question: normalizeText('Generator Drive and Standby Power Module の3つのLightを説明しなさい。'),
      question_type: 'condition_list',
      expected_answer_style: 'list',
      check_status: CONFIG.STATUS.CANDIDATE_READY,
      confirmed_answer_id: '',
      created_at: nowIso_(),
      updated_at: nowIso_()
    });
  }

  if (!readObjects_(pageSheet).some(function (row) { return row.page_id === 'pg_24_d0_09'; })) {
    appendObject_(pageSheet, STUDY_SCHEMA.textbook_pages, {
      page_id: 'pg_24_d0_09',
      ata: '24',
      source_id: 'src_sg_24_ref',
      pdf_name: '24_REF.pdf',
      pdf_page: 21,
      page_code: 'D0-09',
      page_type: 'text',
      section_code: '24-00',
      section_title: 'Electrical Power',
      title: 'GENERATOR DRIVE AND STANDBY POWER MODULE - GENERAL DESCRIPTION',
      body_text: 'Generator Drive and Standby Power Module は IDG Low Oil Pressure Indication(DRIVE Light), STANDBY PWR OFF Light, Generator Drive Disconnect Switch, Standby Power Switch を扱う。',
      normalized_text: normalizeText('Generator Drive and Standby Power Module DRIVE Light STANDBY PWR OFF Light Generator Drive Disconnect Switch Standby Power Switch'),
      keywords: 'Generator Drive,Standby Power Module,DRIVE Light,STANDBY PWR OFF Light',
      related_page_code: 'F0-09',
      related_page_id: 'pg_24_f0_09',
      drive_url: '',
      created_at: nowIso_(),
      updated_at: nowIso_()
    });
    appendObject_(pageSheet, STUDY_SCHEMA.textbook_pages, {
      page_id: 'pg_24_f0_09',
      ata: '24',
      source_id: 'src_sg_24_ref',
      pdf_name: '24_REF.pdf',
      pdf_page: 20,
      page_code: 'F0-09',
      page_type: 'figure',
      section_code: '24-00',
      section_title: 'Electrical Power',
      title: 'GEN DRIVE AND STANDBY POWER MODULE-DESCRIPTION',
      body_text: 'Generator Drive and Standby Power Module figure page.',
      normalized_text: normalizeText('Generator Drive and Standby Power Module figure DRIVE Light STANDBY PWR OFF Light'),
      keywords: 'Generator Drive,Standby Power Module,figure',
      related_page_code: 'D0-09',
      related_page_id: 'pg_24_d0_09',
      drive_url: '',
      created_at: nowIso_(),
      updated_at: nowIso_()
    });
  }

  if (!readObjects_(candidateSheet).some(function (row) { return row.candidate_id === 'cand_24_sample_d0_09'; })) {
    appendObject_(candidateSheet, STUDY_SCHEMA.candidate_links, {
      candidate_id: 'cand_24_sample_d0_09',
      question_id: 'q_24_sample_standby_light',
      page_id: 'pg_24_d0_09',
      ata: '24',
      candidate_group: 'best',
      page_code: 'D0-09',
      pdf_page: 21,
      title: 'GENERATOR DRIVE AND STANDBY POWER MODULE - GENERAL DESCRIPTION',
      section_title: 'Electrical Power',
      excerpt: 'Module は IDG Low Oil Pressure Indication(DRIVE Light) と STANDBY PWR OFF Light を扱う。',
      score: 95,
      match_terms: 'Generator Drive,Standby Power Module,Light',
      rank: 1,
      generated_by: 'manual',
      generated_at: nowIso_(),
      user_status: 'none'
    });
    appendObject_(candidateSheet, STUDY_SCHEMA.candidate_links, {
      candidate_id: 'cand_24_sample_f0_09',
      question_id: 'q_24_sample_standby_light',
      page_id: 'pg_24_f0_09',
      ata: '24',
      candidate_group: 'related_figure',
      page_code: 'F0-09',
      pdf_page: 20,
      title: 'GEN DRIVE AND STANDBY POWER MODULE-DESCRIPTION',
      section_title: 'Electrical Power',
      excerpt: 'Generator Drive and Standby Power Module の関連図ページ。',
      score: 70,
      match_terms: 'Generator Drive,Standby Power Module',
      rank: 2,
      generated_by: 'manual',
      generated_at: nowIso_(),
      user_status: 'none'
    });
  }

  if (!readObjects_(termSheet).some(function (row) { return row.term === 'IDG'; })) {
    [
      ['IDG', 'Integrated Drive Generator', '', 'Generator Drive', '24', ''],
      ['GCU', 'Generator Control Unit', '', '', '24', ''],
      ['BPCU', 'Bus Power Control Unit', '', '', '24', ''],
      ['TRU', 'Transformer Rectifier Unit', '', '', '24', '']
    ].forEach(function (row) {
      appendObject_(termSheet, STUDY_SCHEMA.term_dictionary, {
        term: row[0],
        full_name: row[1],
        japanese: row[2],
        aliases: row[3],
        ata: row[4],
        note: row[5]
      });
    });
  }
}
