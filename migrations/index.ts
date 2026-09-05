import * as migration_20260830_024359_initial from './20260830_024359_initial';
import * as migration_20260901_161500_evidence_files_and_review_indexes from './20260901_161500_evidence_files_and_review_indexes';
import * as migration_20260904_150000_book_text_source from './20260904_150000_book_text_source';

export const migrations = [
  {
    up: migration_20260830_024359_initial.up,
    down: migration_20260830_024359_initial.down,
    name: '20260830_024359_initial'
  },
  {
    up: migration_20260901_161500_evidence_files_and_review_indexes.up,
    down: migration_20260901_161500_evidence_files_and_review_indexes.down,
    name: '20260901_161500_evidence_files_and_review_indexes'
  },
  {
    up: migration_20260904_150000_book_text_source.up,
    down: migration_20260904_150000_book_text_source.down,
    name: '20260904_150000_book_text_source'
  },
];
