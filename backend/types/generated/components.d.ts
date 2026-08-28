import type { Schema, Struct } from '@strapi/strapi';

export interface QuizOption extends Struct.ComponentSchema {
  collectionName: 'components_quiz_options';
  info: {
    description: 'One selectable answer. isCorrect never leaves the server for a student.';
    displayName: 'Option';
    icon: 'circle';
  };
  attributes: {
    isCorrect: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    text: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface QuizQuestion extends Struct.ComponentSchema {
  collectionName: 'components_quiz_questions';
  info: {
    description: 'A prompt plus its options. Student submits an option id, never an index.';
    displayName: 'Question';
    icon: 'question';
  };
  attributes: {
    options: Schema.Attribute.Component<'quiz.option', true> &
      Schema.Attribute.SetMinMax<
        {
          min: 2;
        },
        number
      >;
    prompt: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'quiz.option': QuizOption;
      'quiz.question': QuizQuestion;
    }
  }
}
