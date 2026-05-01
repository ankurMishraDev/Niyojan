-- SQL Queries to inspect data in all model tables

-- Core Tables
SELECT * FROM organizations;
SELECT * FROM users;
SELECT * FROM field_catalog;
SELECT * FROM skills;

-- Volunteer Tables
SELECT * FROM volunteers;
SELECT * FROM volunteer_skills;
SELECT * FROM volunteer_feedback;

-- Pipeline & Document Tables
SELECT * FROM documents;
SELECT * FROM form_templates;
SELECT * FROM form_template_versions;
SELECT * FROM form_fields;
SELECT * FROM pipeline_routing_manifests;
SELECT * FROM canonical_projections;
SELECT * FROM pii_token_maps;

-- Survey & Need Analysis Tables
SELECT * FROM surveys;
SELECT * FROM survey_responses;
SELECT * FROM needs_analysis;
SELECT * FROM need_skills;

-- AI & Processing Tables
SELECT * FROM ai_extractions;
SELECT * FROM validated_candidates;
SELECT * FROM ai_reasoning_outputs;
SELECT * FROM jobs;

-- Review & Outcome Tables
SELECT * FROM human_reviews;
SELECT * FROM auto_approve_policies;
SELECT * FROM case_outcomes;
SELECT * FROM task_assignments;

-- System Tables
SELECT * FROM audit_events;

-- Specific Queries to check Seeded Volunteers
SELECT 
    u.name, 
    u.email, 
    v.primary_domain, 
    v.profession, 
    v.latitude, 
    v.longitude 
FROM users u 
JOIN volunteers v ON u.id = v.user_id 
WHERE u.email LIKE '%@fake-mp-volunteer.local' 
LIMIT 10;

-- Count of fake volunteers
SELECT count(*) FROM users WHERE email LIKE '%@fake-mp-volunteer.local';
