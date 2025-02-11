// Validator for creating a fixture

import Joi from 'joi';

const createFixtureSchema = Joi.object().keys({
  home_team: Joi.string().required(),
  away_team: Joi.string().required(),
  venue: Joi.string().required(),
  date: Joi.date().iso().required(),
  time: Joi.string().required(),
});

export default createFixtureSchema;
