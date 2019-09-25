import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { AssetPreviewComponent } from '../../../catalog/components/asset-preview/asset-preview.component';
import { Asset } from '../../../common/generated-types';
import { ModalService } from '../../providers/modal/modal.service';

@Component({
    selector: 'vdr-asset-gallery',
    templateUrl: './asset-gallery.component.html',
    styleUrls: ['./asset-gallery.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetGalleryComponent {
    @Input() assets: Asset[];
    /**
     * If true, allows multiple assets to be selected by ctrl+clicking.
     */
    @Input() multiSelect = false;
    @Output() selectionChange = new EventEmitter<Asset[]>();

    selection: Asset[] = [];

    constructor(private modalService: ModalService) {}

    toggleSelection(event: MouseEvent, asset: Asset) {
        const index = this.selection.findIndex(a => a.id === asset.id);
        if (index === -1) {
            if (this.multiSelect && event.ctrlKey) {
                this.selection.push(asset);
            } else {
                this.selection = [asset];
            }
        } else {
            if (this.multiSelect && event.ctrlKey) {
                this.selection.splice(index, 1);
            } else if (1 < this.selection.length) {
                this.selection = [asset];
            } else {
                this.selection.splice(index, 1);
            }
        }
        this.selectionChange.emit(this.selection);
    }

    isSelected(asset: Asset): boolean {
        return !!this.selection.find(a => a.id === asset.id);
    }

    lastSelected(): Asset {
        return this.selection[this.selection.length - 1];
    }

    previewAsset(asset: Asset) {
        this.modalService
            .fromComponent(AssetPreviewComponent, {
                size: 'xl',
                closable: true,
                locals: { asset },
            })
            .subscribe();
    }
}
