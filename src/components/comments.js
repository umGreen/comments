import {TweenMax, TweenLite, Power2, TimelineLite} from "gsap";
import _ from 'lodash';
import _tpl_comment from '../templates/comment.njk';
import _tpl_del_comment from '../templates/deleted_comment.njk';
import _tpl_filter from '../templates/filters.njk';
import _tpl_form from '../templates/form.njk';

import {
    MIN_INPUT_LENGTH,
    MAX_INPUT_LENGTH,
    MIN_TEXTAREA_LENGTH,
    MAX_TEXTAREA_LENGTH,
    ADD_COMMENT_ERROR_TIME,
    VIEW_MODS,
    ERRORS,
    AUTHOR_REGEX,
    TEXTAREA_REGEX,
    COMMENT_REGEX,
	INTERACTIVE
} from '../defs';

const localStorage = window.localStorage;


export default class Comments{
	constructor(dom, originData){
	    this._originData = JSON.parse(localStorage.getItem('data')) || originData;

	    if(!localStorage.getItem('data')){
            localStorage.setItem('data', JSON.stringify(this._originData));
        }

        this._dateReverse = false;
        this._ratingReverse = false;

		this._dom = dom;

		dom.addEventListener('click', (...args)=>{ this.mainClick(...args) });

        this.transformDOM();
        this.initTree();
	}

    /**
	 * Метод преобразовывает массив для построения вложенности
     * @param data
     * @returns {Array}
     */
	static transformToTreeData(data){
        return Comments.rollDownData( Comments.setLevels( Comments.rollUpData(data) ) );
	}

    /**
	 * Сворачиваем список для построения дерева
     * @param arr
     * @returns {*}
     */
    static rollUpData(arr){
		arr.forEach( item => {

            if(item.children) item.children = null;

			if(item.parentId !== null) {

				let parentItem = arr.filter( parentItem => parentItem.id === item.parentId )[0];

				if(!parentItem.children) parentItem.children = [];
                parentItem.children.push( item );

			}

		});

        arr = arr.filter( item => item.parentId === null );

        return arr;
	}

    /**
	 * Проставляем уровни смещения (вложенности)
     * @param arr
     * @returns {*}
     */
    static setLevels(arr){

    	let forEachRecur = (arr, idx) => {
            arr.forEach( item => {
            	item._level = idx;
            	if(item.children && item.children.length) forEachRecur(item.children, idx+1);
			})
		};
        forEachRecur(arr, 0);

        return arr;
	}

    /**
	 * Разваорачиваем дерево в одномерный массив
     * @param arr
     * @returns {Array}
     */
    static rollDownData(arr){

		let result = [];

        let forEachRecur = (arr) => {
            arr.forEach( item => {
                result.push(item);
                if(item.children && item.children.length) forEachRecur(item.children);
            })
        };
        forEachRecur(arr);

		return result;
	}

    /**
	 * Изменение рейтига
     * @param obj
     * @param flag
     */
    static removeRatingCtrl(obj, flag){
        let {ratingUp, ratingDown, rating} = obj.view;

        obj._raited = true;
        flag === 'up' ? obj.rating++ : obj.rating--;

        rating.innerHTML = obj.rating;
        ratingUp.remove();
        ratingDown.remove();
    }

	static dateTransform(dateString){
		let date = new Date(dateString);
		return (date.getDate()+1) + '.' + (date.getMonth()+1) + '.' + date.getFullYear() +
			' ' + '(' + date.getHours() + ':' + date.getMinutes() + ')';
	}

	static createNodeFromString(string){
		let _t = document.createElement('div');
		_t.innerHTML = string;
		return _t.childNodes[0];
	}


	mainClick(e){
		let key;
		e.path.forEach( elem => {
			let val = _.findKey(INTERACTIVE, (o)=> {
				let _re = new RegExp(o);
				return _re.test(elem.className)
			});
			if(val) key = val;
		});

		switch (INTERACTIVE[key]){
			case INTERACTIVE.ADD_COMMENT:
				break;
			case INTERACTIVE.COMMENT_DOWN:
				break;
			case INTERACTIVE.COMMENT_UP:
				break;
			case INTERACTIVE.COMMENT_EDIT:
				this.editComment(e);
				break;
			case INTERACTIVE.COMMENT_REMOVE:
				this.removeCommentHandler(e);
				break;
			case INTERACTIVE.COMMENT_REPLY:
				this.replyComment(e);
				break;
			case INTERACTIVE.SORT_DATE:
				break;
			case INTERACTIVE.SORT_RATE:
				break;
			case INTERACTIVE.SORT_TREE:
				break;
			default:
				break;
		}
	}


    /**
     *
     */
    initTree(){
        if(!this._viewType) this._viewType = VIEW_MODS.TREE;

	    this._data = _.cloneDeep(this._originData);

        this._replyCommentId = null;

    	let list = this._dom.querySelector('.comment-list');
        list.innerHTML = '';

        switch(this._viewType){
            case VIEW_MODS.TREE:
                this._data = Comments.transformToTreeData( this._data );
                break;
            case VIEW_MODS.RATING:
	            this._data = this._data.filter( item => item._status !== 'deleted');
                this._data.sort( (a, b) => this._ratingReverse ? a.rating < b.rating : a.rating > b.rating );
                break;
            case VIEW_MODS.DATE:
	            this._data = this._data.filter( item => item._status !== 'deleted');
                this._data.sort( (a, b) => this._dateReverse ?
                    new Date(a.date) < new Date(b.date) :
                    new Date(a.date) > new Date(b.date)
                );
                break;
        }

        this._data.forEach( comment => this.addComment( comment ) );
	}


    /**
     *
     */
    transformDOM(){
        let cList = document.createElement('div'),
            addCForm = document.createElement('div');
        cList.className = 'comment-list';
        addCForm.className = 'comment-add-form';

        this._addCForm = {};
	    this._sort = {};

        this._dom.appendChild( this._sort.view = Comments.createNodeFromString(_tpl_filter.render()) );
        this._dom.appendChild( this._cList = cList );
        this._dom.appendChild( this._addCForm.view = Comments.createNodeFromString(_tpl_form.render()) );

        this._addCForm.addBtn = this._addCForm.view.querySelector('.add-from__add');
        this._addCForm.error = this._addCForm.view.querySelector('.add-from__error');
        this._addCForm.textarea = this._addCForm.view.querySelector('.add-from__text textarea');
        this._addCForm.author = this._addCForm.view.querySelector('.add-from__author input');

        this._addCForm.addBtn.addEventListener('click', (...args) => { this.addCommentToEnd(...args) });

        this._sort.dateSort = this._sort.view.querySelector('#sortDate');
        this._sort.rateSort = this._sort.view.querySelector('#sortRating');
        this._sort.treeMode = this._sort.view.querySelector('#treeMode');

        this._sort.dateSort.addEventListener('click', (e) => { this.sortComments(e, VIEW_MODS.DATE) });
        this._sort.rateSort.addEventListener('click', (e) => { this.sortComments(e, VIEW_MODS.RATING) });
        this._sort.treeMode.addEventListener('click', (e) => { this.sortComments(e, VIEW_MODS.TREE) });
	}


    /**
	 * Добавление комментария в DOM-дерево
     * @param data
     */
	addComment( data ){
		let renderData = {
			author: data.author,
			date: Comments.dateTransform(data.date),
			comment: data.text,
			rating: data.rating
		};

	    let commentHtml = Comments.createNodeFromString(
		    data._status === 'deleted' ? _tpl_del_comment.render(renderData) : _tpl_comment.render(renderData)
	    );
	    commentHtml.id = data.id;
	    commentHtml.style.marginLeft = data._level * 50 + 'px';
	    this._cList.appendChild(commentHtml);

	    data.view = {};
	    data.view.block = commentHtml;

	    if(data._status === 'deleted') return false;

	    [ ['editBtn', 'edit'], ['removeBtn', 'remove'], ['replyBtn', 'reply'], ['rating', 'rating'],
		    ['ratingDown', 'down'], ['ratingUp', 'up'], ['text', 'text']]
		    .forEach( arr => data.view[ arr[0] ] = commentHtml.querySelector('.comment__' + arr[1]) );

        data.ratingDownListener = 	(...args) => this.ratingDown(...args);
        data.ratingUpListener = 	(...args) => this.ratingUp(...args);

        data.view.ratingDown.addEventListener('click', data.ratingDownListener);
        data.view.ratingUp.addEventListener('click', data.ratingUpListener);
	}


    /**
	 * Добавление комментария в конец дерева
     */
    addCommentToEnd(){
    	let {textarea, author} = this._addCForm;

        this.hideError();

        if(author.value.length < MIN_INPUT_LENGTH) this.viewError(ERRORS.SHORT_NAME);
        if(author.value.length > MAX_INPUT_LENGTH) this.viewError(ERRORS.LONG_NAME);
        if(textarea.value.length < MIN_TEXTAREA_LENGTH) this.viewError(ERRORS.SHORT_TEXT);
        if(textarea.value.length > MAX_TEXTAREA_LENGTH) this.viewError(ERRORS.LONG_TEXT);
        if(AUTHOR_REGEX.test(author.value)) this.viewError(ERRORS.BAD_NAME);

        if(!this._errorView){
            this.hideError();

            let idArr = this._originData.map( item => item.id ).sort( (a, b) => a > b );

            let lastId = idArr.length ? idArr[ idArr.length-1 ] : 1;

            console.log('lastId ➥', lastId);

            this._originData.push({
                id: lastId+1,
                parentId: this._replyCommentId || null,
                author: author.value,
                text: textarea.value = textarea.value.replace(TEXTAREA_REGEX, '<br/>'),
                rating: 0,
                date: new Date()
            });

            localStorage.setItem('data', JSON.stringify(this._originData));

            author.value = '';
            textarea.value = '';

            this.initTree();
        }
	}


    /**
     * @param text
     */
    viewError(text){
        let {error} = this._addCForm;

        this._errorView = true;

        if(!error.innerHTML) error.innerHTML = 'Ошибка: ';

        error.innerHTML += '<br />' + text;
    };

    /**
     */
    hideError(){
        let {error} = this._addCForm;

        this._errorView = false;

        error.innerHTML = '';
    }


    /**
	 * Меняем режим сохранить/редактировать
     * @param e
     */
	editComment(e){
		let commentData = this.findComment(e);

		commentData.editStatus = !commentData.editStatus;

		let {editBtn, block, text} = commentData.view,
            newTextBlock;

		// Меняем текст кнопки редактировать/сохранить
        editBtn.innerHTML = commentData.editStatus ? 'save' : 'edit';

		if(commentData.editStatus){
			// Создание <textarea> и установка значения из модели
			newTextBlock = document.createElement('textarea');
			newTextBlock.value = commentData.text.replace(COMMENT_REGEX, '\n');
		} else {

            if(text.value.length < MIN_TEXTAREA_LENGTH) {
                text.value = 'Ок. Это пустой комментарий';
            }

			// Замена <textarea> на <div> и сохраниене значения из <textarea>
			commentData.text = text.value.substr(0, MAX_TEXTAREA_LENGTH);
			newTextBlock = document.createElement('div');

			let string = commentData.text.replace(TEXTAREA_REGEX, '<br>');
            string = string.substr(0, MAX_TEXTAREA_LENGTH);

			newTextBlock.innerHTML = string;

            this._originData.forEach( item => {
                if(item.id === commentData.id) item.text = string;
            });
		}

		newTextBlock.className = 'comment__text';

		block.removeChild(commentData.view.text);
		block.insertBefore(newTextBlock, block.children[1]);

        commentData.view.text = newTextBlock;


        localStorage.setItem('data', JSON.stringify(this._originData));
	}


    /**
     *
     * @param e
     */
    removeCommentHandler(e){
		this.removeComment( this.findComment(e) );
	};


    /**
	 * Удалить комментарий
     * @param commentData
     */
	removeComment(commentData){
		let {editBtn, removeBtn, replyBtn, ratingDown, ratingUp} = commentData.view;

		// Ремувим хэндлеры, чтобы не висели в замыкании
        editBtn.removeEventListener('click', commentData.editListener);
        removeBtn.removeEventListener('click', commentData.removeListener);
        replyBtn.removeEventListener('click', commentData.replyListener);
        ratingDown.removeEventListener('click', commentData.ratingDownListener);
        ratingUp.removeEventListener('click', commentData.ratingUpListener);

        // Удаляем блок из DOM-дерева
        //this._cList.removeChild( block );

		// Удаляем данные из модели
		//this._data = this._data.filter( obj => obj !== commentData );
	    commentData._status = 'deleted';

	    let _t = document.createElement('div');
	    _t.innerHTML = _tpl_del_comment.render({
		    author: commentData.author, date: Comments.dateTransform(commentData.date)
	    });
	    let commentHtml = _t.childNodes[0];
	    commentHtml.style.marginLeft = commentData._level * 50 + 'px';

	    this._cList.replaceChild(commentHtml, commentData.view.block);
	    commentData.view.block = commentHtml;

		// this._originData = this._data.filter( obj => obj.id !== commentData.id );
		this._originData.forEach( obj => {
			if(obj.id === commentData.id) obj._status = 'deleted';
		});
        localStorage.setItem('data', JSON.stringify(this._originData));
	}


    /**
     *
     */
    removeComments(){
        this._data.forEach( item => this.removeComment( item ) );
	}


    /**
     * Добавить комментарий
     * @param e
     */
	replyComment(e){
        let replyComment = this.findComment(e);

        this._replyCommentId = replyComment.id;
	}


    /**
	 * Поиск объекта в модели по DOM-элементу
     * @param e
     */
	findComment(e){
		let commentDiv = e.path.filter( node => node.className === 'comment' )[0];

		return this._data.filter( obj => obj.view.block === commentDiv )[0];
	}


    /**
	 * Увеличение рейтинг
     * @param e
     */
	ratingUp(e){
        let commentData = this.findComment(e);
        Comments.removeRatingCtrl( commentData, 'up' );

        let obj = this._originData.find( item => item.id === commentData.id );
        obj.rating +=1;

        localStorage.setItem('data', JSON.stringify(this._originData));

        this.initTree();
	}


    /**
	 * Уменьшение рейтинга
     * @param e
     */
    ratingDown(e){
        let commentData = this.findComment(e);
        Comments.removeRatingCtrl( commentData, 'down' );

        let obj = this._originData.find( item => item.id === commentData.id );
        obj.rating -=1;

        localStorage.setItem('data', JSON.stringify(this._originData));

        this.initTree();
	}


    /**
     *
     * @param e
     * @param sortType
     */
    sortComments(e, sortType){
        e.preventDefault();

        switch(sortType){
            case VIEW_MODS.DATE:
                this._dateReverse = !this._dateReverse;
                break;
            case VIEW_MODS.RATING:
                this._ratingReverse = !this._ratingReverse;
                break;
        }

        this._viewType = sortType;

        this.initTree();
    }
}