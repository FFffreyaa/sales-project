INSERT OR IGNORE INTO `roles` (`id`,`code`,`name`) VALUES
  ('role-technical-reviewer','technical_reviewer','技术评审人'),
  ('role-professional-reviewer','professional_reviewer','专业评审人');

INSERT OR IGNORE INTO `users` (`id`,`display_name`) VALUES
  ('technical-reviewer-wang','王评审'),
  ('professional-reviewer-wu','吴评审');

INSERT OR IGNORE INTO `user_roles` (`user_id`,`role_id`) VALUES
  ('technical-reviewer-wang','role-technical-reviewer'),
  ('professional-reviewer-wu','role-professional-reviewer');
