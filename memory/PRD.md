# Ranking Matemática – Equipes

## Overview
A gamification mobile app in Portuguese (pt-BR) for math studies targeting students from 6th to 9th grade. Features points system for video lessons and exercises, team rankings, and a complete admin panel.

## Core Features

### Authentication
- **Login**: Email/password authentication with JWT tokens
- **Register**: New user registration with optional team/class selection
- **Admin Login**: danielprofessormatematica@gmail.com / Daniel123*
- **Preview Mode**: Hidden button on login (tap 5 times) to preview admin interface

### User Roles
1. **ALUNO (Student)**: View rankings, own progress
2. **ALUNO_LIDER (Team Leader)**: View team members' individual scores and BNCC skills
3. **ADMIN**: Full access to all management features

### Rankings
- **General Ranking**: All teams across all classes
- **Class Ranking**: Filter by 6º, 7º, 8º, 9º Ano
- Team colors: Alfa=#FFD700 (gold), Delta=#4169E1 (blue), Omega=#32CD32 (green)

### Gamification
- **Streak System**: Daily login tracking (consecutive days)
- **Points from Videos**: Based on watched time (configurable multiplier)
- **Points from Exercises**: Based on score percentage

### Student Features
- Home screen with ranking header and quick actions
- Video player with completion tracking (90% to complete)
- Exercise viewer with multiple choice and text answers
- Progress screen with stats breakdown
- Team screen for leaders (BNCC analysis)

### Admin Panel
- Dashboard with statistics
- User management (CRUD, role assignment)
- Content management (videos, materials)
- Exercise creation (manual with rich question editor)
- Reports (BNCC errors, top students)

## Technical Stack
- **Frontend**: React Native (Expo Router)
- **Backend**: FastAPI with MongoDB
- **Auth**: JWT tokens with bcrypt password hashing

## Database Collections
- usuarios, turmas, equipes
- conteudos, exercicios, questoes
- submissoes, progresso_video
- erros_bncc, notificacoes, abas

## Seed Data
- 4 Classes: 6º, 7º, 8º, 9º Ano
- 3 Teams: Alfa, Delta, Omega
- 1 Admin user
- 6 Sample students
- 1 Team leader
- 1 Sample video
- 1 Sample exercise with 3 questions
