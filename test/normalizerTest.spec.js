'use strict';
import { is, fromJS } from 'immutable';
import { assert as assert0, expect as expect0, should as should0 } from 'chai';

import iChaiImmutable from 'chai';
import chaiImmutable from 'chai-immutable';

iChaiImmutable.use(chaiImmutable)

const { assert, expect, should } = iChaiImmutable;

import loggerMiddleware from 'redux-logger';

import { createStore, combineReducers, applyMiddleware } from 'redux';

import json from './mocks/articles.json';
import jsonUpdate from './mocks/articles_update.json';
import jsonObject from './mocks/article_comments.json';
import jsonUsers from './mocks/users.json';
import { normalize, Schema, arrayOf, NormalizedRecord } from '../src/index';

import { Record, List, Map } from 'immutable';

const reducerKey = 'myReducer';

const Tag = Record({
  id:null,
  label: null
});

const User = Record({
  id:null,
  nickName: null,
});

const Article = Record({
  //base comment
  id:null,
  txt:null,
  user:new User(),
  tags:new List(),
  comments:new List()

});

const schemas = {
  article : new Schema('articles', Article, { idAttribute: 'id', reducerKey: reducerKey }),
  user : new Schema('users', User, { idAttribute: 'id', reducerKey: reducerKey  }),
  tag : new Schema('tags', Tag, { idAttribute: 'id', reducerKey: reducerKey  })
};

schemas.article.define({
  user: schemas.user,
  tags: arrayOf(schemas.tag),
  comments:arrayOf(schemas.article)
});

const initialState = new NormalizedRecord();

function myReducer(state = initialState, action) {
  if(action.type === 'articles'){
    return state.merge(action.payload);
  }else if(action.type === 'clear'){
    return initialState;
  }
  return state;
};

function inboxReducer(state = initialState, action) {
  return state;
};

const store = createStore(combineReducers({
  myReducer,
  inboxReducer
}),{},applyMiddleware(
  // loggerMiddleware()
));

describe("test normalizr", () => {

    it("should work against the immutable normalizr", () => {

      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{});

      expect(normalized).to.have.property('entities');
      expect(normalized).to.have.property('result');
      expect(normalized.result).to.have.size(4);
      expect(normalized.entities).to.have.property('users');
      expect(normalized.entities.users).to.have.property(193);
      expect(normalized.entities).to.have.property('articles');
      expect(normalized.entities.articles).to.have.property(49441);
      expect(normalized.entities.articles[49441]).to.have.property('user');
      expect(normalized.entities.articles[49441].user).to.equal(193);
    });

    it("should allow a proxy function to lazy load the reference", () => {

      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        debug:false
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      })

      expect(normalized.entities.articles[49443].user.id).to.equal(192);
      expect(normalized.entities.articles.get(49443).user.get('id')).to.equals(192);
      expect(normalized.entities.articles.get(49443).user.nickName).to.equal('Marc');

    });

    it("show dynamic state changes after the reference has passed and not just a passed static state", () => {

      let normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        debug:false
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      });

      normalized = normalize(jsonUpdate.articles.items, arrayOf(schemas.article),{
        getState:store.getState
      });

      expect(normalized.entities.articles[49444].user.id).to.equal(193);
    });

    it("should process a single object", () => {

      const normalized = normalize(jsonObject, schemas.article,{
        getState:store.getState,
        debug:false
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      })

      expect(normalized.entities.articles[49443].user.id).to.equal(192);
      expect(normalized.entities.articles.get(50001).user.get('id')).to.equal(193);
      expect(normalized.entities.articles.get(50002).user.nickName).to.equal('Marc');

    });

    it("should process iterables", () => {

      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        debug:false
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      })

      expect(normalized.entities.articles[49443].tags).to.have.size(2);
      expect(normalized.entities.articles.get(49443).tags.get(0).label).to.equal("React");
    });

    it("accesses objects across different reducers", () => {

      const mySchemas = {
        article : new Schema('articles', Article, { idAttribute: 'id', reducerKey: reducerKey }),
        user : new Schema('users', User, { idAttribute: 'id', reducerKey: 'userReducer' }),
        tag : new Schema('tags', Tag, { idAttribute: 'id', reducerKey: reducerKey  })
      };

      mySchemas.article.define({
        user: mySchemas.user,
        tags: arrayOf(mySchemas.tag),
        comments:arrayOf(mySchemas.article)
      });

      function userReducer(state = initialState, action) {
        if(action.type === 'users')
          return state.merge(action.payload);
        return state;
      };

      const myStore = createStore(combineReducers({
        myReducer,
        userReducer
      }),{},applyMiddleware(
        // loggerMiddleware()
      ));

      const normalized = normalize(json.articles.items, arrayOf(mySchemas.article),{
        getState:myStore.getState
      });

      const normalizedUsers = normalize(jsonUsers.users, arrayOf(mySchemas.user),{
        getState:myStore.getState
      });

      myStore.dispatch({
        type:'articles',
        payload:normalized
      });

      myStore.dispatch({
        type:'users',
        payload:normalizedUsers
      });

      expect(normalized.entities.articles[49443].user.id).to.equal(192);
      expect(normalized.entities.articles.get(49443).user.get('id')).to.equal(192);
      expect(normalized.entities.articles.get(49443).user.nickName).to.equal('Marc');

    });

    it("equals Objects as different Proxies pass is(r1,r2)", () => {
      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        debug:false
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      })

      expect(normalized.entities.articles[49442].user).to.equal(normalized.entities.articles[49442].user);
      expect(normalized.entities.articles[49442].user).to.equal(normalized.entities.articles[49443].user);
      expect(is(normalized.entities.articles[49442].user,normalized.entities.articles[49442].user)).to.be.true;
      expect(is(normalized.entities.articles[49442].user,normalized.entities.articles[49443].user)).to.be.true;

    });

    it("allows useMapsForEntities to use Maps instead of Records for entity objects", () => {
      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      });

      expect(normalized.entities.articles.get('49443').user.id).to.equal(192);
      expect(normalized.entities.articles.get('49443').user.nickName).to.equal('Marc');

    });

    it("allows merging of new data", () => {
      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true
      });

      const normalizedUpdate = normalize(jsonUpdate.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true
      });

      const normalizedMerged = normalized.entities.articles.merge(normalizedUpdate.entities.articles);

      expect(normalizedMerged).to.contain.key('49444');

      const normalizedRecord = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:false
      });

      const normalizedUpdateRecord = normalize(jsonUpdate.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:false
      });

      try{
        normalizedRecord.entities.articles.merge(normalizedUpdateRecord.entities.articles)
        should().fail('We cannot merge Records when keys are added.');
      }catch(err){}

    });

    it("allows deep merging of new data", () => {

      store.dispatch({
        type:'clear'
      });

      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true
      });

      const normalizedUpdate = normalize(jsonUpdate.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true
      });

      const normalizedMerged = normalized.entities.merge(normalizedUpdate.entities);

      expect(normalizedMerged.articles).to.contain.key('49444');
      expect(normalizedMerged.articles).to.contain.key('49441');
      //this is a record that only exists in normalized and not in normalizedUpdate
      expect(normalizedMerged.articles).to.not.contain.key('49449');

    });

    it("allows deep merging of new data using deepMerge", () => {

      store.dispatch({
        type:'clear'
      });

      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true,
        debug:true
      });

      const normalizedUpdate = normalize(jsonUpdate.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true,
        debug:true
      });
      
      const normalizedMerged = normalized.entities.mergeDeep(normalizedUpdate.entities);

      expect(normalizedMerged.articles).to.contain.key('49441');
      expect(normalizedMerged.articles).to.contain.key('49444');
      expect(normalizedMerged.articles).to.contain.key('49449');
      expect(normalizedMerged.articles.get('49443').tags.get(0).id).to.equal(19);

    });

    it("allows accessing results through a proxy", () => {
      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:store.getState,
        useProxyForResults:true
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      });

      expect(normalized.result.get(0).user.nickName).to.equal('Diogenes');
    });

    it("should allow late binding of the result list", () => {
      const normalized = normalize(json.articles.items, arrayOf(schemas.article),{
        getState:undefined,
        useProxyForResults:true,
        useProxy:true,
        debug:true
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      });

      const statifiedResult = function(state){
        return normalized;
      };

      const res = statiefiedResult(store.getState);

      console.log(res);

      expect(normalized.result.get(0)(store.getState).txt).to.be.a('string');
      expect(normalized.result.get(0)(store.getState).user.nickName).to.equal('Marc');
      expect(normalized.result.get(0)()).to.equal(49441);


    });

    it("should produce test output", () => {
      const altSchemas = {
        article : new Schema('articles', Article, { idAttribute: 'id', reducerKey: reducerKey }),
        user : new Schema('users', User, { idAttribute: 'id', reducerKey: 'inboxReducer'  }),
        tag : new Schema('tags', Tag, { idAttribute: 'id', reducerKey: reducerKey  })
      };

      altSchemas.article.define({
        user: altSchemas.user,
        tags: arrayOf(altSchemas.tag),
        comments:arrayOf(altSchemas.article)
      });

      let normalized = normalize(json.articles.items, arrayOf(altSchemas.article),{
        getState:store.getState,
        useMapsForEntityObjects:true,
        useProxyForResults:true,
        debug:false
      });

      store.dispatch({
        type:'articles',
        payload:normalized
      })

      console.log(normalized.result.get(0).user.nickName);

    });

    it("show processing of unions", () => {

    });
});
