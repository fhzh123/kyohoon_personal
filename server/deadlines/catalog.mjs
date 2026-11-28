// The conferences shown on the deadline page, their field and the body that runs them.
// `ccf` names the conference in ccfddl/ccf-deadlines (folder/file), `hf` the file in
// huggingface/ai-deadlines. Either may be missing when that dataset does not track it.

export const CATEGORIES=[
  {id:'nlp',name:'NLP',full:'Natural Language Processing'},
  {id:'ml',name:'ML',full:'Machine Learning / AI'},
  {id:'cv',name:'CV',full:'Computer Vision'},
  {id:'dm',name:'Data Mining & Web',full:'Data Mining, Web and Information Retrieval'}
];

// logo: a file under /icons. A body with no logo file is shown by its short name.
export const ORGANIZERS={
  acl:{name:'ACL',full:'Association for Computational Linguistics',url:'https://www.aclweb.org/',logo:'/icons/venues/acl.svg'},
  iccl:{name:'ICCL',full:'International Committee on Computational Linguistics',url:'https://coling-iccl.org/'},
  colm:{name:'COLM',full:'Conference on Language Modeling',url:'https://colmweb.org/'},
  iclr:{name:'ICLR',full:'International Conference on Learning Representations',url:'https://iclr.cc/'},
  imls:{name:'IMLS',full:'International Machine Learning Society',url:'https://icml.cc/'},
  neurips:{name:'NeurIPS Foundation',full:'Neural Information Processing Systems Foundation',url:'https://neurips.cc/'},
  aaai:{name:'AAAI',full:'Association for the Advancement of Artificial Intelligence',url:'https://aaai.org/'},
  ijcai:{name:'IJCAI',full:'International Joint Conferences on Artificial Intelligence Organization',url:'https://www.ijcai.org/'},
  cvf:{name:'IEEE/CVF',full:'IEEE Computer Society and the Computer Vision Foundation',url:'https://www.thecvf.com/',logo:'/icons/ieee.svg'},
  ecva:{name:'ECVA',full:'European Computer Vision Association',url:'https://www.ecva.net/'},
  acm:{name:'ACM',full:'Association for Computing Machinery',url:'https://www.acm.org/',logo:'/icons/acm.svg'},
  pakdd:{name:'PAKDD',full:'PAKDD Steering Committee',url:'https://www.pakdd.net/'},
  ecmlpkdd:{name:'ECML PKDD',full:'ECML PKDD Steering Committee',url:'https://ecmlpkdd.org/'}
};

export const CONFERENCES=[
  {id:'acl',name:'ACL',full:'Annual Meeting of the Association for Computational Linguistics',categories:['nlp'],organizer:'acl',ccf:'AI/acl',hf:'acl'},
  {id:'emnlp',name:'EMNLP',full:'Conference on Empirical Methods in Natural Language Processing',categories:['nlp'],organizer:'acl',ccf:'AI/emnlp',hf:'emnlp'},
  {id:'naacl',name:'NAACL',full:'Annual Conference of the North American Chapter of the ACL',categories:['nlp'],organizer:'acl',ccf:'AI/naacl',hf:'naacl'},
  {id:'eacl',name:'EACL',full:'Conference of the European Chapter of the ACL',categories:['nlp'],organizer:'acl',ccf:'AI/eacl'},
  {id:'coling',name:'COLING',full:'International Conference on Computational Linguistics',categories:['nlp'],organizer:'iccl',ccf:'AI/coling',hf:'coling'},
  {id:'colm',name:'COLM',full:'Conference on Language Modeling',categories:['nlp'],organizer:'colm',ccf:'AI/colm',hf:'colm'},
  {id:'iclr',name:'ICLR',full:'International Conference on Learning Representations',categories:['ml'],organizer:'iclr',ccf:'AI/iclr',hf:'iclr'},
  {id:'icml',name:'ICML',full:'International Conference on Machine Learning',categories:['ml'],organizer:'imls',ccf:'AI/icml',hf:'icml'},
  {id:'neurips',name:'NeurIPS',full:'Conference on Neural Information Processing Systems',categories:['ml'],organizer:'neurips',ccf:'AI/nips',hf:'neurips'},
  {id:'aaai',name:'AAAI',full:'AAAI Conference on Artificial Intelligence',categories:['ml'],organizer:'aaai',ccf:'AI/aaai',hf:'aaai'},
  {id:'ijcai',name:'IJCAI',full:'International Joint Conference on Artificial Intelligence',categories:['ml'],organizer:'ijcai',ccf:'AI/ijcai',hf:'ijcai'},
  {id:'cvpr',name:'CVPR',full:'IEEE/CVF Conference on Computer Vision and Pattern Recognition',categories:['cv'],organizer:'cvf',ccf:'AI/cvpr',hf:'cvpr'},
  {id:'iccv',name:'ICCV',full:'IEEE/CVF International Conference on Computer Vision',categories:['cv'],organizer:'cvf',ccf:'AI/iccv',hf:'iccv'},
  {id:'eccv',name:'ECCV',full:'European Conference on Computer Vision',categories:['cv'],organizer:'ecva',ccf:'AI/eccv',hf:'eccv'},
  {id:'kdd',name:'KDD',full:'ACM SIGKDD Conference on Knowledge Discovery and Data Mining',categories:['dm'],organizer:'acm',ccf:'DB/sigkdd',hf:'kdd'},
  {id:'wsdm',name:'WSDM',full:'ACM International Conference on Web Search and Data Mining',categories:['dm'],organizer:'acm',ccf:'DB/wsdm',hf:'wsdm'},
  {id:'www',name:'WWW',full:'The ACM Web Conference',categories:['dm'],organizer:'acm',ccf:'MX/www',hf:'www'},
  {id:'pakdd',name:'PAKDD',full:'Pacific-Asia Conference on Knowledge Discovery and Data Mining',categories:['dm'],organizer:'pakdd',ccf:'DB/pakdd'},
  {id:'ecmlpkdd',name:'ECML PKDD',full:'European Conference on Machine Learning and Principles and Practice of Knowledge Discovery in Databases',categories:['dm','ml'],organizer:'ecmlpkdd',ccf:'DB/pkdd',hf:'ecml_pkdd'}
];

// Deadline kinds, in the order a paper meets them.
export const KINDS=['abstract','submission','supplementary','reviews','rebuttal','commitment','notification','camera_ready','other'];
