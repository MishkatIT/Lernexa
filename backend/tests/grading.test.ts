import { describe, it, expect } from 'vitest';
import {
  gradeQuiz,
  toStudentQuiz,
  type Quiz,
} from '../src/api/quiz/services/grading';

const quiz: Quiz = {
  id: 1,
  title: 'Basics',
  questions: [
    {
      id: 10,
      prompt: '2 + 2?',
      options: [
        { id: 100, text: '3', isCorrect: false },
        { id: 101, text: '4', isCorrect: true },
      ],
    },
    {
      id: 11,
      prompt: 'Sky colour?',
      options: [
        { id: 110, text: 'Blue', isCorrect: true },
        { id: 111, text: 'Green', isCorrect: false },
      ],
    },
  ],
};

describe('toStudentQuiz', () => {
  it('strips isCorrect from every option', () => {
    const s = toStudentQuiz(quiz);
    const serialised = JSON.stringify(s);
    expect(serialised).not.toContain('isCorrect');
    expect(s.questions[0].options[0]).toEqual({ id: 100, text: '3' });
  });
});

describe('gradeQuiz', () => {
  it('all correct', () => {
    const r = gradeQuiz(quiz, [
      { questionId: 10, selectedOptionId: 101 },
      { questionId: 11, selectedOptionId: 110 },
    ]);
    expect(r).toMatchObject({ score: 2, totalQuestions: 2 });
    expect(r.answers.every((a) => a.correct)).toBe(true);
  });

  it('all wrong', () => {
    const r = gradeQuiz(quiz, [
      { questionId: 10, selectedOptionId: 100 },
      { questionId: 11, selectedOptionId: 111 },
    ]);
    expect(r.score).toBe(0);
  });

  it('partial', () => {
    const r = gradeQuiz(quiz, [
      { questionId: 10, selectedOptionId: 101 },
      { questionId: 11, selectedOptionId: 111 },
    ]);
    expect(r.score).toBe(1);
  });

  it('a missing answer is not correct', () => {
    const r = gradeQuiz(quiz, [{ questionId: 10, selectedOptionId: 101 }]);
    expect(r.score).toBe(1);
    expect(r.answers.find((a) => a.questionId === 11)).toMatchObject({
      selectedOptionId: null,
      correct: false,
    });
  });

  it('an unknown / stale option id is not correct', () => {
    const r = gradeQuiz(quiz, [
      { questionId: 10, selectedOptionId: 9999 },
      { questionId: 11, selectedOptionId: 110 },
    ]);
    expect(r.score).toBe(1);
    expect(r.answers[0].correct).toBe(false);
  });

  it('a question with no correct option is unwinnable', () => {
    const broken: Quiz = {
      id: 2,
      title: 'Broken',
      questions: [
        {
          id: 20,
          prompt: 'No right answer marked',
          options: [
            { id: 200, text: 'A', isCorrect: false },
            { id: 201, text: 'B', isCorrect: false },
          ],
        },
      ],
    };
    const r = gradeQuiz(broken, [{ questionId: 20, selectedOptionId: 200 }]);
    expect(r).toEqual({
      score: 0,
      totalQuestions: 1,
      answers: [{ questionId: 20, selectedOptionId: 200, correct: false }],
    });
  });

  it('empty quiz', () => {
    const r = gradeQuiz({ id: 3, title: 'Empty', questions: [] }, []);
    expect(r).toEqual({ score: 0, totalQuestions: 0, answers: [] });
  });

  it('ids compare across number/string', () => {
    const r = gradeQuiz(quiz, [{ questionId: '10', selectedOptionId: '101' }]);
    expect(r.answers[0].correct).toBe(true);
  });
});
