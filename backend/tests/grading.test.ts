import { describe, it, expect } from 'vitest';
import {
  gradeQuiz,
  toStudentQuiz,
  buildAttemptReview,
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

describe('buildAttemptReview', () => {
  it('freezes prompt + both option labels for a correct answer', () => {
    const result = gradeQuiz(quiz, [{ questionId: 10, selectedOptionId: 101 }]);
    const review = buildAttemptReview(quiz, result);
    expect(review[0]).toEqual({
      questionId: 10,
      prompt: '2 + 2?',
      selectedOptionId: 101,
      selectedOptionText: '4',
      correctOptionId: 101,
      correctOptionText: '4',
      correct: true,
    });
  });

  it('records the correct answer even when the student got it wrong', () => {
    const result = gradeQuiz(quiz, [{ questionId: 11, selectedOptionId: 111 }]);
    const row = buildAttemptReview(quiz, result).find((r) => r.questionId === 11)!;
    expect(row).toMatchObject({
      selectedOptionText: 'Green',
      correctOptionText: 'Blue',
      correct: false,
    });
  });

  it('a blank answer has null selected text but still names the correct one', () => {
    const result = gradeQuiz(quiz, []);
    const row = buildAttemptReview(quiz, result)[0];
    expect(row).toMatchObject({
      selectedOptionId: null,
      selectedOptionText: null,
      correctOptionText: '4',
      correct: false,
    });
  });

  it('a question with no correct option marked leaves correctOptionText null', () => {
    const broken: Quiz = {
      id: 9,
      title: 'Broken',
      questions: [
        {
          id: 90,
          prompt: 'Unwinnable',
          options: [
            { id: 900, text: 'A', isCorrect: false },
            { id: 901, text: 'B', isCorrect: false },
          ],
        },
      ],
    };
    const review = buildAttemptReview(
      broken,
      gradeQuiz(broken, [{ questionId: 90, selectedOptionId: 900 }]),
    );
    expect(review[0]).toMatchObject({
      selectedOptionText: 'A',
      correctOptionId: null,
      correctOptionText: null,
      correct: false,
    });
  });

  it('one row per quiz question, in quiz order', () => {
    const review = buildAttemptReview(quiz, gradeQuiz(quiz, []));
    expect(review.map((r) => r.questionId)).toEqual([10, 11]);
  });
});
