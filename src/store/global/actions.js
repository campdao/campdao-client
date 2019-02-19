import ScatterJS, {Network} from 'scatterjs-core';
import ScatterEOS from 'scatterjs-plugin-eosjs2';
import { Notify } from 'quasar';

import { Api, JsonRpc, RpcError, JsSignatureProvider } from 'eosjs';
const { TextDecoder, TextEncoder } = require('text-encoding');
import {EosWrapper} from '../../modules/eoswrapper.js';


ScatterJS.plugins( new ScatterEOS() );
//

export async function connectScatter ({state, commit, dispatch, rootGetters}, trigger_login = false) {

    let network = await state.networks.find(n => n.name == state.active_network);

    ScatterJS.scatter.connect('testapp', {network}).then(async connected => {
          if(!connected){
              console.error('Could not connect to Scatter.');

              commit('user/setAccountName', false, { root: true } );

              if(rootGetters['user/getSettingByName']('notify_error_msg').value){
                Notify.create({
                    message: `Signature provider not found`,
                    timeout: 2000,
                    type: 'negative',
                    position: 'bottom-right'
                });
              }

              return;
          }

          console.log('scatter connected');
          commit('setScatter', ScatterJS.scatter);

          if(ScatterJS.scatter.identity){
              //logged in
              console.log('logged in')
              dispatch('user/loggedInRoutine', state.scatter.identity.accounts[0].name, {root:true} );

              if(rootGetters['user/getSettingByName']('notify_info_msg').value){
                Notify.create({
                    message: `Welcome back ${state.scatter.identity.accounts[0].name}`,
                    timeout: 2000,
                    type: 'info',
                    position: 'bottom-right'
                });
              }

          }
          else{
              //scatter connected but not logged in
              console.log('please log in.');
              if(trigger_login && state.scatter !== null) await dispatch('login');
          }

          ScatterJS = null;
    })
}

export async function login({state, dispatch, rootGetters}){

    console.log('request login')
    if(state.scatter === null){
      console.log('scatter not found, trying to connect scatter');
      if(rootGetters['user/getSettingByName']('notify_info_msg').value){
        Notify.create({
            message: `Trying to connect to signature provider`,
            timeout: 1500,
            type: 'info',
            position: 'bottom-right'
        });
      }
      await dispatch('connectScatter', true);
      return;
    };
    let account = await state.scatter.login().catch(e=> {console.log(e); return false});

    if(account && account.accounts[0]){
        dispatch('user/loggedInRoutine', account.accounts[0].name, {root:true} );
        console.log(`logged in ${account.accounts[0].name} on ${state.active_network}`);

        if(rootGetters['user/getSettingByName']('notify_info_msg').value){
            Notify.create({
                message: `Welcome ${account.accounts[0].name}`,
                timeout: 2000,
                type: 'info',
                position: 'bottom-right'
            });
        }
    }

}


export async function logout({state, dispatch}){
    
    console.log('request logout')
    if(!state.scatter){
      console.log('scatter not found');
      return;
    };
    dispatch('user/loggedOutRoutine',null, {root:true} );
    await state.scatter.logout().catch(e=>console.log(e));
    
    console.log('loggedout');
}

export async function switchAccount({state, dispatch}){
    await dispatch('logout');
    await dispatch('login');

}

export async function getEosApi({state, commit}, rebuild=false){

    if(state.eosApi && !rebuild){
        console.log('got eos api from store')
        return state.eosApi;
    }

    console.log('build and store eos api')
    let n = Network.fromJson(state.networks.find(n => n.name == state.active_network) );
    let rpc = new JsonRpc(n.fullhost() );
    let api = await new Api({ rpc, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
    commit('setEosApi', new EosWrapper(api, state.config) );
    return state.eosApi;
}

export async function getEosScatter({state, commit}, rebuild=false){
    if(state.eosScatter && !rebuild){
        console.log('got scatter api from store');
        return state.eosScatter;
    }
    console.log('build and store scatter api')
    let network = Network.fromJson(state.networks.find(n => n.name == state.active_network) );
    let rpc = new JsonRpc(network.fullhost() );
    let eos = state.scatter.eos(network, Api, {rpc, beta3:true} );
    commit('setEosScatter', [eos] );
    return [eos];
    
}

export async function loadConfig({Vue,state, commit}, payload ){
    console.log(`loading new config file ${payload.networkname} in to store`)
    const config = require(`../../statics/config.${payload.networkname}.json`);
    state.config = config;

    if(payload.vm){
        //setting new config in the plugin
        payload.vm.$configFile.configFile = state.config;
    }
}


export async function switchNetwork({state, commit, dispatch, rootGetters}, payload){

    if(state.active_network == payload.networkname){
        console.log(`already connected to ${networkname}`);
        return true;
    }

    let network = state.networks.find(n => n.name == payload.networkname);
    if(!network){
        console.log(`network ${payload.networkname} doesn't exists`);
        return false;
    }
    console.log('switching to ' + payload.networkname);
    if(rootGetters['user/getSettingByName']('notify_info_msg').value){
        Notify.create({
            message: `Switching network`,
            timeout: 1500, // in milliseconds; 0 means no timeout
            type: 'info',
            detail: `switching to ${payload.networkname}`,
            position: 'bottom-right', // 'top', 'left', 'bottom-left' etc.
        });
    }
    commit('setActiveNetwork', payload.networkname);
    await dispatch('loadConfig', payload);
    await dispatch('logout');
    /////////////////////////////////////////
    console.log('resetting profilecache...');
    payload.vm.$profiles.cache = [];
    console.log('profile cache:', payload.vm.$profiles.cache);
    payload.vm.$profiles.config = state.config;
    /////////////////////////////////////////

    dispatch('dac/initRoutine', null, {root : true});
    await dispatch('connectScatter', true);
 
}

export async function changeNode({state, commit}, payload){

    let network = state.networks.find(n => n.name == state.active_network);

    if( typeof payload == 'string'){
        payload = new URL(payload);
    }
    console.log(Network);

    network.host=payload.host;
    network.protocol=payload.protocol;
    network.port=payload.port;
    commit('setEosApi', null );
    commit('setEosScatter', null );

}
