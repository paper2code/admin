(function(factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node / CommonJS
        factory(require('jquery'));
    } else {
        // Browser globals.
        factory(jQuery);
    }
})(function($) {
    'use strict';

    let NAMESPACE = 'qor.redactor',
        EVENT_ENABLE = 'enable.' + NAMESPACE,
        EVENT_DISABLE = 'disable.' + NAMESPACE,
        EVENT_CLICK = 'click.' + NAMESPACE,
        EVENT_KEYUP = 'keyup.' + NAMESPACE,
        EVENT_ADD_CROP = 'addCrop.' + NAMESPACE,
        EVENT_REMOVE_CROP = 'removeCrop.' + NAMESPACE,
        EVENT_SHOWN = 'shown.qor.modal',
        EVENT_HIDDEN = 'hidden.qor.modal',
        EVENT_SCROLL = 'scroll.' + NAMESPACE,
        CLASS_WRAPPER = '.qor-cropper__wrapper',
        CLASS_SAVE = '.qor-cropper__save',
        CLASS_CROPPER_TOGGLE = '.qor-cropper__toggle--redactor',
        ID_REDACTOR_LINK_TITLE = '#redactor-link-title',
        ID_REDACTOR_LINK_TEXT = '#redactor-link-url-text',
        ID_REDACTOR_MODAL_BUTTON_CANCEL = '#redactor-modal-button-cancel';

    function encodeCropData(data) {
        var nums = [];

        if ($.isPlainObject(data)) {
            $.each(data, function() {
                nums.push(arguments[1]);
            });
        }

        return nums.join();
    }

    function decodeCropData(data) {
        var nums = data && data.split(',');

        data = null;

        if (nums && nums.length === 4) {
            data = {
                x: Number(nums[0]),
                y: Number(nums[1]),
                width: Number(nums[2]),
                height: Number(nums[3])
            };
        }

        return data;
    }

    function capitalize(str) {
        if (typeof str === 'string') {
            str = str.charAt(0).toUpperCase() + str.substr(1);
        }

        return str;
    }

    function getCapitalizeKeyObject(obj) {
        var newObj = {},
            key;

        if ($.isPlainObject(obj)) {
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    newObj[capitalize(key)] = obj[key];
                }
            }
        }

        return newObj;
    }

    function replaceText(str, data) {
        if (typeof str === 'string') {
            if (typeof data === 'object') {
                $.each(data, function(key, val) {
                    str = str.replace('$[' + String(key).toLowerCase() + ']', val);
                });
            }
        }

        return str;
    }

    function escapeHTML(unsafe_str) {
        return unsafe_str
            .replace(/&/g, ' ')
            .replace(/</g, ' ')
            .replace(/>/g, ' ')
            .replace(/\"/g, ' ')
            .replace(/\'/g, ' ')
            .replace(/\`/g, ' ');
    }

    function redactorToolbarSrcoll($editor, toolbarFixedTopOffset) {
        let $toolbar = $editor.find('.redactor-toolbar'),
            offsetTop = $editor.offset().top,
            editorHeight = $editor.height(),
            normallCSS = {
                position: 'relative',
                top: 'auto',
                width: 'auto',
                boxShadow: 'none'
            },
            fixedCSS = {
                position: 'fixed',
                boxShadow: '0 2px 4px rgba(0,0,0,.1)',
                top: toolbarFixedTopOffset,
                width: $editor.width()
            };

        if ($toolbar.css('position') === 'relative') {
            editorHeight = $editor.height() - 50;
        }

        if (offsetTop < toolbarFixedTopOffset) {
            if (editorHeight - 50 - toolbarFixedTopOffset < Math.abs(offsetTop)) {
                $toolbar.css(normallCSS);
            } else {
                $toolbar.css(fixedCSS);
            }
        } else {
            $toolbar.css(normallCSS);
        }
    }

    function QorRedactor(element, options) {
        this.$element = $(element);
        this.options = $.extend(true, {}, QorRedactor.DEFAULTS, $.isPlainObject(options) && options);
        this.init();
    }

    QorRedactor.prototype = {
        constructor: QorRedactor,

        init: function() {
            var options = this.options;
            var $this = this.$element;
            var $parent = $this.closest(options.parent);

            if (!$parent.length) {
                $parent = $this.parent();
            }

            this.$parent = $parent;
            this.$button = $(QorRedactor.BUTTON);
            this.$modal = $(replaceText(QorRedactor.MODAL, options.text)).appendTo('body');
            this.bind();
        },

        bind: function() {
            this.$element.on(EVENT_ADD_CROP, $.proxy(this.addButton, this)).on(EVENT_REMOVE_CROP, $.proxy(this.removeButton, this));
        },

        unbind: function() {
            this.$element
                .off(EVENT_ADD_CROP)
                .off(EVENT_REMOVE_CROP)
                .off(EVENT_SCROLL);
        },

        addButton: function(e, image) {
            var $image = $(image);

            this.$button
                .css('left', $(image).width() / 2)
                .prependTo($image.parent())
                .find(CLASS_CROPPER_TOGGLE)
                .one(EVENT_CLICK, $.proxy(this.crop, this, $image));
        },

        removeButton: function() {
            this.$button.find(CLASS_CROPPER_TOGGLE).off(EVENT_CLICK);
            this.$button.detach();
        },

        crop: function($image) {
            let options = this.options,
                url = $image.attr('src'),
                originalUrl = url,
                $clone,
                $modal = this.$modal;

            if ($.isFunction(options.replace)) {
                originalUrl = options.replace(originalUrl);
            }

            $clone = $(`<img src='${originalUrl}'>`);

            $modal
                .one(EVENT_SHOWN, function() {
                    $clone.cropper({
                        data: decodeCropData($image.attr('data-crop-options')),
                        background: false,
                        movable: false,
                        zoomable: false,
                        scalable: false,
                        rotatable: false,
                        checkImageOrigin: false,

                        ready: function() {
                            $modal.find(CLASS_SAVE).one(EVENT_CLICK, function() {
                                var cropData = $clone.cropper('getData', true);

                                $.ajax(options.remote, {
                                    type: 'POST',
                                    contentType: 'application/json',
                                    data: JSON.stringify({
                                        Url: url,
                                        CropOptions: {
                                            original: getCapitalizeKeyObject(cropData)
                                        },
                                        Crop: true
                                    }),
                                    dataType: 'json',

                                    success: function(response) {
                                        if ($.isPlainObject(response) && response.url) {
                                            $image
                                                .attr('src', response.url)
                                                .attr('data-crop-options', encodeCropData(cropData))
                                                .removeAttr('style')
                                                .removeAttr('rel');

                                            if ($.isFunction(options.complete)) {
                                                options.complete();
                                            }
                                            $modal.qorModal('hide');
                                        }
                                    }
                                });
                            });
                        }
                    });
                })
                .one(EVENT_HIDDEN, function() {
                    $clone.cropper('destroy').remove();
                })
                .qorModal('show')
                .find(CLASS_WRAPPER)
                .append($clone);
        },

        destroy: function() {
            this.unbind();
            this.$modal.qorModal('hide').remove();
            this.$element.removeData(NAMESPACE);
        }
    };

    QorRedactor.DEFAULTS = {
        remote: false,
        parent: false,
        toggle: false,
        replace: null,
        complete: null,
        text: {
            title: 'Crop the image',
            ok: 'OK',
            cancel: 'Cancel'
        }
    };

    QorRedactor.BUTTON = `<div class="qor-redactor__image--buttons">
            <span class="qor-redactor__image--edit" contenteditable="false">Edit</span>
            <span class="qor-cropper__toggle--redactor" contenteditable="false">Crop</span>
        </div>`;

    QorRedactor.MODAL = `<div class="qor-modal fade" tabindex="-1" role="dialog" aria-hidden="true">
            <div class="mdl-card mdl-shadow--2dp" role="document">
              <div class="mdl-card__title">
                <h2 class="mdl-card__title-text">$[title]</h2>
              </div>
              <div class="mdl-card__supporting-text">
                <div class="qor-cropper__wrapper"></div>
              </div>
              <div class="mdl-card__actions mdl-card--border">
                <a class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect qor-cropper__save">$[ok]</a>
                <a class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect" data-dismiss="modal">$[cancel]</a>
              </div>
              <div class="mdl-card__menu">
                <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect" data-dismiss="modal" aria-label="close">
                  <i class="material-icons">close</i>
                  </button>
              </div>
            </div>
        </div>`;

    QorRedactor.plugin = function(option) {
        return this.each(function() {
            let $this = $(this),
                data = $this.data(NAMESPACE),
                config,
                fn;

            if (!data) {
                if (!$.fn.redactor) {
                    return;
                }

                if (/destroy/.test(option)) {
                    return;
                }

                $this.data(NAMESPACE, (data = {}));

                let editorButtons = ['html', 'format', 'bold', 'italic', 'deleted', 'lists', 'image', 'file', 'link', 'table'];

                config = {
                    imageUpload: $this.data('uploadUrl'),
                    fileUpload: $this.data('uploadUrl'),
                    imageResizable: true,
                    toolbarFixed: false,
                    buttons: editorButtons,

                    callbacks: {
                        init: function() {
                            let button,
                                $editor = this.core.box(),
                                isInSlideout = $('.qor-slideout').is(':visible'),
                                toolbarFixedTarget,
                                toolbarFixedTopOffset = 64;

                            editorButtons.forEach(function(item) {
                                button = this.button.get(item);
                                this.button.setIcon(button, '<i class="material-icons ' + item + '"></i>');
                            }, this);

                            if (isInSlideout) {
                                toolbarFixedTarget = '.qor-slideout__body';
                                toolbarFixedTopOffset = $('.qor-slideout__header').height();
                            } else {
                                toolbarFixedTarget = '.qor-layout main.qor-page';
                                toolbarFixedTopOffset =
                                    toolbarFixedTopOffset +
                                    $(toolbarFixedTarget)
                                        .find('.qor-page__header')
                                        .height();
                            }

                            $(toolbarFixedTarget).on(EVENT_SCROLL, function() {
                                redactorToolbarSrcoll($editor, toolbarFixedTopOffset);
                            });

                            if (!$this.data('cropUrl')) {
                                return;
                            }

                            $this.data(
                                NAMESPACE,
                                (data = new QorRedactor($this, {
                                    remote: $this.data('cropUrl'),
                                    text: $this.data('text'),
                                    parent: '.qor-field',
                                    toggle: '.qor-cropper__toggle--redactor',
                                    replace: function(url) {
                                        return url.replace(/\.\w+$/, function(extension) {
                                            return '.original' + extension;
                                        });
                                    },
                                    complete: $.proxy(function() {
                                        this.code.sync();
                                    }, this)
                                }))
                            );
                        },

                        imageUpload: function(image, json) {
                            var $image = $(image);
                            json.filelink && $image.prop('src', json.filelink);
                        },

                        click: function(e) {
                            var $currentTag = $(this.selection.parent());

                            if ($currentTag.is('.redactor-layer')) {
                                $currentTag = $(this.selection.current());
                            }
                            this.selection.$currentTag = $currentTag;
                            this.link.linkDescription = '';
                            this.link.insertedTriggered = false;
                            this.link.valueChanged = false;

                            if (this.link.is()) {
                                this.link.linkDescription = this.link.get().prop('title');
                                this.link.$linkHtml = $(e.target);
                            }
                        },

                        modalOpened: function(name, modal) {
                            var _this = this;
                            if (name == 'link') {
                                $(modal)
                                    .find('#redactor-link-url-text')
                                    .closest('section')
                                    .after(
                                        '<section><label>Description for Accessibility</label><input value="' +
                                            this.link.linkDescription +
                                            '" type="text" id="redactor-link-title" placeholder="If blank, will use Text value above" /></section>'
                                    );

                                this.link.linkUrlText = $(ID_REDACTOR_LINK_TEXT).val();
                                this.link.description = $(ID_REDACTOR_LINK_TITLE).val();

                                $(ID_REDACTOR_LINK_TITLE).off(EVENT_KEYUP);
                                $(ID_REDACTOR_LINK_TEXT).off(EVENT_KEYUP);
                                $(ID_REDACTOR_MODAL_BUTTON_CANCEL).off(EVENT_CLICK);

                                $(ID_REDACTOR_MODAL_BUTTON_CANCEL).on(EVENT_CLICK, function() {
                                    _this.link.clickCancel = true;
                                });

                                $(ID_REDACTOR_LINK_TITLE).on(EVENT_KEYUP, function() {
                                    _this.link.valueChanged = true;
                                    _this.link.description = escapeHTML($(this).val());
                                });

                                $(ID_REDACTOR_LINK_TEXT).on(EVENT_KEYUP, function() {
                                    _this.link.valueChanged = true;
                                    _this.link.linkUrlText = escapeHTML($(this).val());
                                });
                            }
                        },

                        modalClosed: function(name) {
                            var $linkHtml = this.link.$linkHtml,
                                description = this.link.description;

                            if (name == 'link' && !this.link.insertedTriggered && $linkHtml && $linkHtml.length && this.link.valueChanged && !this.link.clickCancel) {
                                if (description) {
                                    $linkHtml.prop('title', description);
                                } else {
                                    $linkHtml.prop('title', this.link.linkUrlText);
                                }
                            }

                            $('#redactor-image-displaymode').remove();

                            this.link.description = '';
                            this.link.linkUrlText = '';
                            this.link.insertedTriggered = false;
                            this.link.valueChanged = false;
                            this.link.clickCancel = false;
                        },

                        insertedLink: function(link) {
                            var $link = $(link),
                                description = this.link.description;

                            $link.prop('title', description ? description : $link.text());
                            this.link.description = '';
                            this.link.linkUrlText = '';
                            this.link.insertedTriggered = true;
                        },

                        fileUpload: function(link, json) {
                            $(link)
                                .prop('href', json.filelink)
                                .html(json.filename);
                        }
                    }
                };

                $.extend(config, $this.data('redactorSettings'));
                $this.redactor(config);
            } else {
                if (/destroy/.test(option)) {
                    $this.redactor('core.destroy');
                }
            }

            if (typeof option === 'string' && $.isFunction((fn = data[option]))) {
                fn.apply(data);
            }
        });
    };

    $(function() {
        var selector = 'textarea[data-toggle="qor.redactor"]';

        $(document)
            .on(EVENT_DISABLE, function(e) {
                QorRedactor.plugin.call($(selector, e.target), 'destroy');
            })
            .on(EVENT_ENABLE, function(e) {
                QorRedactor.plugin.call($(selector, e.target));
            })
            .triggerHandler(EVENT_ENABLE);
    });

    return QorRedactor;
});
